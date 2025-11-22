import { get, writable, type Readable } from 'svelte/store';
import { publicClient } from '$lib/connection';
import { creditsDivider } from '$lib/config';
import type { GetFeeHistoryReturnType } from 'viem';

export type GasPrice = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };
export type EstimateGasPriceResult = GasPrice[];

export type GasFee = { error?: { message: string } } & (
	| {
			step: 'Idle';
	  }
	| {
			step: 'Loading';
	  }
	| {
			step: 'Loaded';
			slow: GasPrice;
			average: GasPrice;
			fast: GasPrice;
	  }
);

function defaultState() {
	return {
		step: 'Idle'
	} as const;
}

function avg(arr: bigint[]) {
	const sum = arr.reduce((a: bigint, v: bigint) => a + v);
	return sum / BigInt(arr.length);
}

export function createGasFeeStore(options?: { fetchInterval?: number }) {
	const fetchInterval = options?.fetchInterval || 60 * 1000; // 1 minute

	let $state: GasFee = defaultState();

	const _store = writable<GasFee>($state, start);
	function set(state: GasFee) {
		$state = state;
		_store.set($state);
		return $state;
	}

	async function fetchState(): Promise<boolean> {
		if ($state.step !== 'Loaded') {
			set({
				step: 'Loading'
			});
		}

		const blockCount = 20;
		const rewardPercentiles = [10, 50, 80];

		let feeHistory: GetFeeHistoryReturnType;
		try {
			feeHistory = await publicClient.getFeeHistory({
				blockCount,
				rewardPercentiles,
				blockTag: 'pending'
			});
		} catch (err) {
			set({
				step: 'Loading',
				error: { message: `failed to fetch fee history for` }
			});
			return false;
		}

		const reward = feeHistory.reward!;

		let blockNum = Number(feeHistory.oldestBlock);
		const lastBlock = blockNum + reward.length;
		let index = 0;
		const blocksHistory: {
			number: number;
			baseFeePerGas: bigint;
			gasUsedRatio: number;
			priorityFeePerGas: bigint[];
		}[] = [];
		while (blockNum < lastBlock) {
			blocksHistory.push({
				number: blockNum,
				baseFeePerGas: feeHistory.baseFeePerGas[index],
				gasUsedRatio: feeHistory.gasUsedRatio[index],
				priorityFeePerGas: reward[index]
			});
			blockNum += 1;
			index += 1;
		}

		const percentilePriorityFeeAverages: bigint[] = [];
		for (let i = 0; i < rewardPercentiles.length; i++) {
			percentilePriorityFeeAverages.push(avg(blocksHistory.map((b) => b.priorityFeePerGas[i])));
		}

		const baseFeePerGas = feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1];

		const result: EstimateGasPriceResult = [];
		for (let i = 0; i < rewardPercentiles.length; i++) {
			result.push({
				maxFeePerGas: percentilePriorityFeeAverages[i] + baseFeePerGas,
				maxPriorityFeePerGas: percentilePriorityFeeAverages[i]
			});
		}
		set({
			step: 'Loaded',
			slow: result[0],
			average: result[1],
			fast: result[2]
		});
		return true;
	}

	async function fetchContinuously() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}

		let interval = fetchInterval;
		try {
			const success = await fetchState();
			if (!success) {
				interval = 500;
			}
		} finally {
			if (!timeout) {
				timeout = setTimeout(fetchContinuously, interval);
			}
		}
	}

	let timeout: NodeJS.Timeout | undefined;
	function start() {
		fetchContinuously();

		return stop;
	}

	async function update() {
		await fetchContinuously();
		return $state;
	}

	function stop() {
		set(defaultState());

		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
	}

	return {
		subscribe: _store.subscribe,
		update,
		get value() {
			return $state.step === 'Loaded' ? $state : undefined;
		}
	};
}

export const gasFee = createGasFeeStore();

(globalThis as any).gasFee = gasFee;
