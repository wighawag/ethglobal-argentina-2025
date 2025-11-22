import { connection } from '$lib/connection';
import deployments from '$lib/deployments';
import { derived, writable, type Readable } from 'svelte/store';

export type LastSync = { timestampMS: number; blockNumber: number; averageBlockTime: number };
export type SyncedTime = {
	lastSync?: LastSync;
	value: number;
};

function formatTime(timestamp: number): string {
	return `${new Date(timestamp * 1000).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	})},${(timestamp * 1000) % 1000}`;
}

export function createTime(chainInfo?: { minPollingInterval?: number }) {
	let minPollingInterval = chainInfo?.minPollingInterval || 200;

	let last_time = Math.floor(Date.now() / 1000);
	let last_fetch_time_ms = Date.now();
	let last_fetch_block_number: number | null = null;

	let pollingInterval: NodeJS.Timeout | null = null;
	let hasAccurateTime = false; // Track if we have the most accurate blockchain time

	let $time: SyncedTime = { value: last_time };
	const time = writable<SyncedTime>($time, start);

	function set(newTime: SyncedTime) {
		$time.lastSync = newTime.lastSync;
		$time.value = newTime.value;
		time.set($time);
	}

	function start() {
		// Main time update interval (updates every second)
		const timeUpdateInterval = setInterval(() => {
			const now = Date.now();
			const timePassedMS = now - last_fetch_time_ms;
			set({ value: last_time + timePassedMS / 1000, lastSync: $time.lastSync });
		}, 1000);

		// Start with immediate first approximation
		initialSync();

		return () => {
			clearInterval(timeUpdateInterval);
			if (pollingInterval) {
				clearInterval(pollingInterval);
				pollingInterval = null;
			}
		};
	}

	async function initialSync() {
		const synced = await updateTimeFromProvider();
		if (synced) {
			// Initial sync successful, now start polling to catch the next block
			// for maximum accuracy, then we'll stop polling
			startBlockPolling(synced);
		} else {
			console.error('Initial sync failed, retrying...');
			setTimeout(initialSync, 1000);
		}
	}

	function startBlockPolling(lastSync: LastSync) {
		// Only start polling if we don't have accurate time yet
		if (hasAccurateTime) return;

		// Poll more frequently for faster networks, less for slower ones
		// Aim for roughly 1/10th of expected block time
		const pollInterval = Math.max(
			Math.floor((lastSync.averageBlockTime * 1000) / 100),
			minPollingInterval
		);

		pollingInterval = setInterval(async () => {
			try {
				const before_fetch = Date.now();
				const latestBlockResponse = await connection.provider.call('eth_getBlockByNumber')([
					'latest',
					false as true // TODO fix eip-1193 Methods
				]);

				if (latestBlockResponse.success && latestBlockResponse.value) {
					const latestBlockNumber = Number(latestBlockResponse.value.number);
					const latestBlockTime = Number(latestBlockResponse.value.timestamp);

					console.debug(
						`got ${latestBlockNumber} at ${formatTime(latestBlockTime)}, ${formatTime((before_fetch + Date.now()) / 2 / 1000)}`
					);

					// If we have a new block, we now have the most accurate blockchain time
					if (last_fetch_block_number === null || latestBlockNumber > last_fetch_block_number) {
						const after_fetch = Date.now();
						const predicted_fetch_time = (before_fetch + after_fetch) / 2;

						updateTimeFromBlock(
							predicted_fetch_time,
							{
								blockTime: latestBlockTime,
								blockNumber: latestBlockNumber
							},
							lastSync.averageBlockTime
						);

						// We now have the most accurate blockchain time, stop polling
						hasAccurateTime = true;
						if (pollingInterval) {
							clearInterval(pollingInterval);
							pollingInterval = null;
						}
					}
				}
			} catch (err) {
				// Silently fail on polling errors to avoid console spam
				console.debug('Block polling failed:', err);
			}
		}, pollInterval);
	}

	function updateTimeFromBlock(
		fetchTimeMS: number,
		block: { blockTime: number; blockNumber: number },
		averageBlockTime: number
	) {
		last_time = block.blockTime;
		last_fetch_time_ms = fetchTimeMS;
		last_fetch_block_number = block.blockNumber;

		const nowMS = Date.now();
		const timePassedMS = nowMS - last_fetch_time_ms;
		console.debug(`timePassed: ${timePassedMS / 1000}`);
		console.debug(`time is ${formatTime(last_time + timePassedMS / 1000)}`);
		const lastSync = {
			timestampMS: last_fetch_time_ms,
			blockNumber: block.blockNumber,
			averageBlockTime
		};
		set({
			value: last_time + timePassedMS / 1000,
			lastSync
		});
		return lastSync;
	}

	async function updateTimeFromProvider(): Promise<LastSync | undefined> {
		const before_fetch = Date.now();
		try {
			const latestBlockResponse = await connection.provider.call('eth_getBlockByNumber')([
				'latest',
				false as true // TODO fix eip-1193 Methods
			]);

			if (latestBlockResponse.success && latestBlockResponse.value) {
				const latestBlockTime = Number(latestBlockResponse.value.timestamp);
				const latestBlockNumber = Number(latestBlockResponse.value.number);
				const after_fetch = Date.now();
				const predicted_fetch_time = (before_fetch + after_fetch) / 2;

				console.debug(
					`our first block (${latestBlockNumber}) at ${formatTime(latestBlockTime)} / ${formatTime(predicted_fetch_time)}`
				);

				const distance = 64;
				const sampleSize = latestBlockNumber > distance ? distance : latestBlockNumber;
				const fromBlock = latestBlockNumber - sampleSize;

				const olderBlockResponse = await connection.provider.call('eth_getBlockByNumber')([
					`0x${fromBlock.toString(16)}`,
					false as true // TODO fix eip-1193 Methods
				]);

				let averageBlockTime: number;
				if (olderBlockResponse.success && olderBlockResponse.value) {
					const olderBlockTime = Number(olderBlockResponse.value.timestamp);

					// Calculate the time difference in seconds
					const timeDiff = latestBlockTime - olderBlockTime;

					// Calculate average block time (time difference / number of blocks)
					const blockCount = latestBlockNumber - fromBlock;
					averageBlockTime = timeDiff / blockCount;
				} else {
					return $time.lastSync;
				}

				return updateTimeFromBlock(
					predicted_fetch_time,
					{
						blockTime: latestBlockTime,
						blockNumber: latestBlockNumber
					},
					averageBlockTime
				);
			}
			return $time.lastSync;
		} catch (err) {
			console.error(`failed to fetch from block time`, err);
			return undefined;
		}
	}

	function now() {
		const nowMS = Date.now();
		const timePassedMS = nowMS - last_fetch_time_ms;
		return last_time + timePassedMS / 1000;
	}

	return {
		now,
		subscribe: time.subscribe
	};
}

export const time = createTime({
	minPollingInterval: 100
});

export type EpochInfo = {
	currentEpoch: number;
	timeLeftInEpoch: number;
	timeInCurrentEpochCycle: number;
	isCommitPhase: boolean;
	timeLeftInPhase: number;
	timeLeftForCommitEnd: number;
	timeLeftForRevealEnd: number;
	commitPhaseDuration: number;
	revealPhaseDuration: number;
	currentPhaseDuration: number;
};

export function createLocalComputer(config: {
	COMMIT_PHASE_DURATION: number;
	REVEAL_PHASE_DURATION: number;
	START_TIME?: number;
}) {
	function calculateEpochInfo(currentTime: number): EpochInfo {
		const COMMIT_PHASE_DURATION = config.COMMIT_PHASE_DURATION;
		const REVEAL_PHASE_DURATION = config.REVEAL_PHASE_DURATION;
		const EPOCH_DURATION = COMMIT_PHASE_DURATION + REVEAL_PHASE_DURATION;
		const START_TIME = config.START_TIME || 0;

		const timePassed = currentTime - START_TIME;

		// Calculate current epoch (minimum epoch is 2 as per contract logic)
		const currentEpoch = Math.floor(timePassed / EPOCH_DURATION) + 2;

		// Calculate time within current epoch cycle
		const timeInCurrentEpochCycle = timePassed - (currentEpoch - 2) * EPOCH_DURATION;

		// Calculate time left in current epoch
		const timeLeftInEpoch = EPOCH_DURATION - timeInCurrentEpochCycle;

		// Determine if we're in commit phase or reveal phase
		const isCommitPhase = timeInCurrentEpochCycle < COMMIT_PHASE_DURATION;

		// Calculate time left for commit phase end (when commit phase will end)
		const timeLeftForCommitEnd = isCommitPhase
			? COMMIT_PHASE_DURATION - timeInCurrentEpochCycle
			: 0; // If we're in reveal phase, commit phase has already ended

		// Calculate time left for reveal phase end (when reveal phase will end, i.e., epoch end)
		const timeLeftForRevealEnd = timeLeftInEpoch;

		return {
			currentEpoch,
			timeLeftInEpoch,
			timeInCurrentEpochCycle,
			isCommitPhase,
			timeLeftInPhase: isCommitPhase
				? COMMIT_PHASE_DURATION - timeInCurrentEpochCycle
				: REVEAL_PHASE_DURATION - (timeInCurrentEpochCycle - COMMIT_PHASE_DURATION),
			timeLeftForCommitEnd,
			timeLeftForRevealEnd,
			commitPhaseDuration: COMMIT_PHASE_DURATION,
			revealPhaseDuration: REVEAL_PHASE_DURATION,
			currentPhaseDuration: isCommitPhase ? COMMIT_PHASE_DURATION : REVEAL_PHASE_DURATION
		};
	}

	return {
		calculateEpochInfo
	};
}

export const timeConfig = {
	COMMIT_PHASE_DURATION: Number(deployments.contracts.Game.linkedData.commitPhaseDuration),
	REVEAL_PHASE_DURATION: Number(deployments.contracts.Game.linkedData.revealPhaseDuration),
	START_TIME: Number(deployments.contracts.Game.linkedData.startTime),
	COMMIT_TIME_ALLOWANCE: Number(deployments.contracts.Game.linkedData.revealPhaseDuration) + 0.1
};

export const localComputer = createLocalComputer(timeConfig);

// export const epochInfo = derived(time, (t) => localComputer.calculateEpochInfo(t.value));

const _epochInfo = writable<EpochInfo>(localComputer.calculateEpochInfo(time.now()), (set) => {
	const unsubscribeFromTime = time.subscribe(($time) => {
		set(localComputer.calculateEpochInfo($time.value));
	});
	return unsubscribeFromTime;
});

export const epochInfo = {
	subscribe: _epochInfo.subscribe,
	now() {
		return localComputer.calculateEpochInfo(time.now());
	},
	fromTime(now: number) {
		return localComputer.calculateEpochInfo(now);
	}
};

export type ThreePhase = {
	phase: 'play' | 'commit' | 'reveal';
	timeLeft: number;
	duration: number;
};

export const threePhase = derived<Readable<EpochInfo>, ThreePhase>(epochInfo, ($epochInfo) => {
	let phase: 'play' | 'commit' | 'reveal' = 'reveal';
	let timeLeft = $epochInfo.timeLeftInPhase;
	let duration = $epochInfo.currentPhaseDuration;

	if ($epochInfo.isCommitPhase) {
		phase = 'play';
		if ($epochInfo.timeLeftInPhase < timeConfig.COMMIT_TIME_ALLOWANCE) {
			phase = 'commit';
			duration = timeConfig.COMMIT_TIME_ALLOWANCE;
		} else {
			duration -= timeConfig.COMMIT_TIME_ALLOWANCE;
			timeLeft -= timeConfig.COMMIT_TIME_ALLOWANCE;
		}
	}
	return {
		phase,
		timeLeft,
		duration
	};
});

export type TwoPhase = {
	phase: 'play' | 'wait';
	timeLeft: number;
	duration: number;
};

export const twoPhase = derived<Readable<ThreePhase>, TwoPhase>(threePhase, ($threePhase) => {
	let phase: 'play' | 'wait' = 'play';
	let timeLeft = $threePhase.timeLeft;
	let duration = $threePhase.duration;
	if ($threePhase.phase === 'commit') {
		phase = 'wait';
		timeLeft =
			$threePhase.timeLeft + Number(deployments.contracts.Game.linkedData.revealPhaseDuration); // TODO reuse
		duration =
			$threePhase.duration + Number(deployments.contracts.Game.linkedData.revealPhaseDuration); // TODO reuse
	}
	if ($threePhase.phase === 'reveal') {
		phase = 'wait';
		duration = $threePhase.duration + timeConfig.COMMIT_TIME_ALLOWANCE;
	}
	return {
		phase,
		timeLeft,
		duration
	};
});

(globalThis as any).epochInfo = epochInfo;
(globalThis as any).time = time;
(globalThis as any).threePhase = threePhase;
(globalThis as any).twoPhase = twoPhase;
