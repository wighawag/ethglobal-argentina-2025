import { get, writable, type Readable } from 'svelte/store';
import type { AvatarEntity, OnchainState } from './types';
import { epochInfo, time } from '$lib/time';
import { bigIntIDToXY, calculateVisibleZones, type Position } from 'dgame-contracts';
import { publicClient } from '$lib/connection';
import deployments from '$lib/deployments';
import { type GetContractEventsReturnType } from 'viem';
import type { LocalAction } from '$lib/private/localState';

const Game = deployments.contracts.Game;

type Camera = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function defaultState() {
	return {
		entities: {},
		epoch: 0
	};
}

class TimeNotSyncedError extends Error {}

export function createDirectReadStore(camera: Readable<Camera>) {
	let $state: OnchainState = defaultState();
	let lastCamera: Camera = get(camera);
	let now = get(time);
	let lastEpoch = epochInfo.fromTime(now.value).currentEpoch;
	let lastZones: bigint[] | undefined;

	const _store = writable<OnchainState>($state, start);
	function set(state: OnchainState) {
		$state = state;
		_store.set($state);
		return $state;
	}

	function hasCameraChanged(oldCamera: Camera, newCamera: Camera) {
		return (
			oldCamera.x !== newCamera.x ||
			oldCamera.y !== newCamera.y ||
			oldCamera.width !== newCamera.width ||
			oldCamera.height !== newCamera.height
		);
	}

	function hasZonesChanged(zonesA?: bigint[], zonesB?: bigint[]) {
		if (!zonesA) {
			return true;
		}
		if (!zonesB) {
			return true;
		}
		if (zonesA == zonesB) {
			return false;
		}
		if (zonesA.length != zonesB.length) {
			return true;
		}
		for (let i = 0, l = zonesA.length; i < l; i++) {
			if (zonesA[i] != zonesB[i]) {
				return true;
			}
		}
		return false;
	}

	async function fetchState(camera: Camera, fromCameraUpdate: boolean) {
		const now = get(time);

		if (!now.lastSync) {
			throw new TimeNotSyncedError(`time not synced yet`);
		}

		const zones = calculateVisibleZones(camera);

		if (fromCameraUpdate && !hasZonesChanged(lastZones, zones)) {
			return;
		}

		// TODO has epcoh changed ?
		// if (!fromCameraUpdate && ) {
		// 	return;
		// }

		const result = await publicClient.readContract({
			...Game,
			functionName: 'getAvatarsInMultipleZones',
			args: [zones, 0n, 100n] // TODO use pagination
		});
		if (fromCameraUpdate) {
			const newZones = calculateVisibleZones(lastCamera);
			if (hasZonesChanged(zones, newZones)) {
				// if changed while fetching, we stop right here
				return;
			}
		}

		const epoch = result[2];

		console.debug(`fetched state from epoch: ${epoch}`);

		if (Number(epoch) < lastEpoch) {
			// we consider for refetch
			lastEpoch = Number(epoch);
		}

		const currentBlockNumber = Number(await publicClient.getBlockNumber());
		const avarageBlockTime = now.lastSync.averageBlockTime;

		const blockDistanceToFetchFrom = Math.floor(
			(4 * // we multiply by 4 as we fetch for 2 epochs and we double it to ensure we get all the events even in case of late blocks, etc...
				(Number(deployments.contracts.Game.linkedData.commitPhaseDuration) +
					Number(deployments.contracts.Game.linkedData.revealPhaseDuration))) /
				avarageBlockTime
		);

		let fromBlock = currentBlockNumber - blockDistanceToFetchFrom;
		if (fromBlock < 0) {
			fromBlock = 0;
		}

		const events = await publicClient.getContractEvents({
			...Game,
			eventName: 'CommitmentRevealed',
			args: {
				epoch: [epoch - 1n],
				zone: zones
			},
			strict: true,
			fromBlock: BigInt(fromBlock),
			toBlock: BigInt(currentBlockNumber)
		});
		// console.debug(allEvents);

		const avatarEvents: Map<
			bigint,
			GetContractEventsReturnType<typeof Game.abi, 'CommitmentRevealed', true>[0]
		> = new Map();
		for (const event of events) {
			avatarEvents.set(event.args.avatarID, event);
		}

		const state: OnchainState = defaultState();

		state.epoch = Number(epoch);

		for (const entityFetched of result[0]) {
			const id = entityFetched.avatarID.toString();

			let actions: LocalAction[] = [];

			const event = avatarEvents.get(entityFetched.avatarID);
			if (event) {
				actions = event.args.actions.map((v) => {
					const coords = bigIntIDToXY(v.data);
					return {
						type: v.actionType === 0 ? 'enter' : v.actionType === 1 ? 'move' : 'exit',
						x: coords.x,
						y: coords.y
					};
				});
			}

			const { x, y } = bigIntIDToXY(entityFetched.position);
			const entity: AvatarEntity = {
				id,
				owner: entityFetched.owner,
				type: 'avatar',
				position: {
					x: Number(x),
					y: Number(y)
				},
				life: entityFetched.life,
				lastEpoch: Number(entityFetched.lastEpoch),
				actions
			};
			state.entities[id] = entity;
		}

		lastZones = zones;
		set(state);
	}

	let timeout: NodeJS.Timeout | undefined;
	async function fetchContinuously(fromCameraUpdate?: boolean) {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}

		let retryIn = 15000;
		try {
			await fetchState(lastCamera, fromCameraUpdate || false);
		} catch (err) {
			if (err instanceof TimeNotSyncedError) {
				const timeElapsed = performance.now() / 1000;
				const maxExpectedSyncDelay = 2;
				if (timeElapsed > maxExpectedSyncDelay) {
					console.error(`time not synced, even after ${timeElapsed} seconds`, err);
				}
			} else {
				console.error(`failed to fetch state`, err);
			}

			retryIn = 1000;
		} finally {
			if (!timeout) {
				timeout = setTimeout(fetchContinuously, retryIn);
			}
		}
	}

	let unsubscribeFromCamera: (() => void) | undefined;
	let unsubscribeFromEpochInfo: (() => void) | undefined;

	function start() {
		unsubscribeFromCamera = camera.subscribe((camera) => {
			const cameraChanged = hasCameraChanged(lastCamera, camera);
			if (cameraChanged) {
				lastCamera = { ...camera };
				fetchContinuously(true);
			}
		});

		unsubscribeFromEpochInfo = epochInfo.subscribe((epochInfo) => {
			if (epochInfo.currentEpoch != lastEpoch || $state.epoch != epochInfo.currentEpoch) {
				lastEpoch = epochInfo.currentEpoch;
				fetchContinuously(false);
			}
		});

		fetchContinuously(false);

		return stop;
	}

	async function update() {
		await fetchContinuously();
		return $state;
	}

	function stop() {
		if (unsubscribeFromCamera) {
			unsubscribeFromCamera();
			unsubscribeFromCamera = undefined;
		}

		if (unsubscribeFromEpochInfo) {
			unsubscribeFromEpochInfo();
			unsubscribeFromEpochInfo = undefined;
		}
		if (timeout) {
			clearTimeout(timeout);
		}
		// TODO set as IDle ?
		set(defaultState());
	}

	return {
		subscribe: _store.subscribe,
		update
	};
}
