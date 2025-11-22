import { createDirectReadStore } from '$lib/onchain/direct-read';
import type { StarSystemEntity } from '$lib/onchain/types';
import { camera } from '$lib/render/camera';
import { derived, get } from 'svelte/store';
import { localState } from '../private/localState';

export type Position = { x: number; y: number };

export type StarSystemViewEntity = StarSystemEntity;

export type ViewEntity = StarSystemViewEntity;
type Entities = Map<bigint, ViewEntity>;
export type ViewState = {
	entities: Entities;
	epoch: number;
};

export const onchainState = createDirectReadStore(camera);

export const viewState = derived(
	[onchainState, localState],
	([$onchainState, $localState]): ViewState => {
		const entities: Entities = structuredClone($onchainState.entities); //new Map($onchainState.entities);

		return {
			entities,
			epoch: $onchainState.epoch
		};
	}
);

(globalThis as any).viewState = viewState;
(globalThis as any).get = get;
