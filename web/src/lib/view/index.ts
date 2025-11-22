import { createDirectReadStore } from '$lib/onchain/direct-read';
import type { AvatarEntity } from '$lib/onchain/types';
import { camera } from '$lib/render/camera';
import { derived, get, writable } from 'svelte/store';
import { localState, type LocalAction } from '../private/localState';
import { epochInfo, time } from '$lib/time';

export type Position = { x: number; y: number };

export type AvatarViewEntity = AvatarEntity;

export type ViewEntity = AvatarViewEntity;
export type ViewState = {
	avatarID?: string;
	entities: { [id: string]: ViewEntity };
	epoch: number;
};

export const onchainState = createDirectReadStore(camera);

export const viewState = derived(
	[onchainState, localState],
	([$onchainState, $localState]): ViewState => {
		const { currentEpoch: epoch } = epochInfo.now(); // we use now  instead of deriving from time
		const entities = { ...$onchainState.entities } as { [id: string]: ViewEntity };
		let avatarID: string | undefined;
		if ($localState.signer && $localState.avatar) {
			const currentAvatarID = $localState.avatar.avatarID;
			let avatarEntity = $onchainState.entities[currentAvatarID] as AvatarEntity | undefined;
			if (avatarEntity || !$localState.avatar.exiting) {
				avatarID = currentAvatarID;

				if ($localState.avatar.actions[0]?.type === 'enter') {
					avatarEntity = {
						owner: $localState.signer.owner,
						type: 'avatar',
						id: avatarID,
						life: 1,
						position: $localState.avatar.actions[0],
						lastEpoch: epoch,
						actions: []
					};
				}

				if (avatarEntity) {
					const actions: LocalAction[] = [];
					let current_action: LocalAction = { type: 'move', ...avatarEntity.position };
					actions.push(current_action);
					// console.log(`current pos`, current_position);

					if ($localState.avatar.actions.length > 0 && $localState.avatar.epoch == epoch) {
						for (const action of $localState.avatar.actions) {
							current_action = { ...action };
							actions.push(current_action);
						}
					}
					entities[avatarID] = {
						...avatarEntity,
						position: current_action,
						actions
					};
				}
			}
		}

		for (const entityID of Object.keys(entities)) {
			const entity = entities[entityID];
			if (entity.type === 'avatar' && entityID != avatarID) {
				// TODO
				if (entity.life == 0 && entity.lastEpoch + 1 < epoch) {
					delete entities[entityID];
				}
			}
		}

		return {
			avatarID,
			entities,
			epoch: $onchainState.epoch
		};
	}
);

(globalThis as any).viewState = viewState;
(globalThis as any).get = get;
