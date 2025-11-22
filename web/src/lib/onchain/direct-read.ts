import { get, writable, type Readable } from 'svelte/store';
import type { StarSystemEntity, OnchainState } from './types';
import { epochInfo, time } from '$lib/time';
import { bigIntIDToXY } from 'dgame-contracts';
import { publicClient } from '$lib/connection';
import deployments from '$lib/deployments';
import { type GetContractEventsReturnType } from 'viem';
import type { LocalAction } from '$lib/private/localState';
import { spaceInfo } from '$lib/config';

const Game = deployments.contracts.Game;

type Camera = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function defaultState() {
	return {
		entities: new Map(),
		epoch: 0
	};
}

class TimeNotSyncedError extends Error {}

export function createDirectReadStore(camera: Readable<Camera>) {
	let $state: OnchainState = defaultState();
	let lastCamera: Camera = get(camera);
	let now = get(time);
	let lastEpoch = epochInfo.fromTime(now.value).currentEpoch;
	let lastLocations: bigint[] | undefined;

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

	function hasLocationChanged(locationsA?: bigint[], locationsB?: bigint[]) {
		if (!locationsA) {
			return true;
		}
		if (!locationsB) {
			return true;
		}
		if (locationsA == locationsB) {
			return false;
		}
		if (locationsA.length != locationsB.length) {
			return true;
		}
		for (let i = 0, l = locationsA.length; i < l; i++) {
			if (locationsA[i] != locationsB[i]) {
				return true;
			}
		}
		return false;
	}

	function getVisibleLocations(camera: Camera) {
		const locations = spaceInfo.getPlanetIDsInRect(
			camera.x - camera.width,
			camera.y - camera.height,
			camera.x + camera.width,
			camera.y + camera.height
		);
		return locations;
	}

	async function fetchState(camera: Camera, fromCameraUpdate: boolean) {
		const now = get(time);

		if (!now.lastSync) {
			throw new TimeNotSyncedError(`time not synced yet`);
		}

		const locations = getVisibleLocations(camera);

		if (fromCameraUpdate && !hasLocationChanged(lastLocations, locations)) {
			return;
		}

		// TODO has epcoh changed ?
		// if (!fromCameraUpdate && ) {
		// 	return;
		// }

		const result = await publicClient.readContract({
			...Game,
			functionName: 'getStarSystems',
			args: [locations] // TODO use pagination
		});
		if (fromCameraUpdate) {
			const newLocations = getVisibleLocations(lastCamera);
			if (hasLocationChanged(locations, newLocations)) {
				// if changed while fetching, we stop right here
				return;
			}
		}

		const epoch = result[1];

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

		const state: OnchainState = defaultState();

		state.epoch = Number(epoch);

		for (let i = 0; i < locations.length; i++) {
			const entityFetched = result[0][i];
			const location = locations[i];

			const id = entityFetched.empireID;

			const { x, y } = bigIntIDToXY(location);
			const entity: StarSystemEntity = {
				id,
				owner: entityFetched.owner,
				type: 'starSystem',
				position: {
					x: Number(x),
					y: Number(y)
				}
			};
			state.entities.set(id, entity);
		}

		lastLocations = locations;
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
