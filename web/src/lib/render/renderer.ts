import { viewState, type ViewEntity, type ViewState } from '$lib/view';
import { Container, Graphics } from 'pixi.js';
import type { Readable } from 'svelte/store';
import type { GameObject } from './objects/GameObject';
import { StarSystemObject } from './objects/StarSystemObject';

export function createRenderer(viewState: Readable<ViewState>) {
	let gameObjects: Map<bigint, GameObject> = new Map();
	let unsubscribe: (() => void) | undefined = undefined;

	async function onAppStarted(container: Container) {
		unsubscribe = viewState.subscribe(($viewState) => {
			const processed = new Set();

			function onEntityAdded(id: bigint, entity: ViewEntity): GameObject {
				if (entity.type == 'starSystem') {
					// console.log(`star system added ${entity.id}`);
					const avatarObject = new StarSystemObject(entity);
					container.addChild(avatarObject);
					gameObjects.set(id, avatarObject);
					return avatarObject;
				} else {
					throw new Error(`unknown object type : ${entity.type}`);
				}
			}

			function onEntityRemoved(id: bigint, gameObject: GameObject) {
				// console.log(`entity removed ${id}`);
				// TODO removal type ?
				gameObject.onRemoved();
				container.removeChild(gameObject);
				gameObjects.delete(id);
			}

			function updateEntity(id: bigint, gameObject: GameObject, entity: ViewEntity) {
				gameObject.update(entity, $viewState.epoch);
			}

			const entityIDs = $viewState.entities.keys();
			for (const entityID of entityIDs) {
				processed.add(entityID);

				const entity = $viewState.entities.get(entityID);
				if (!entity) {
					throw new Error(`entity gone: ${entityID}`);
				}
				let gameObject = gameObjects.get(entityID);
				if (!gameObject) {
					gameObject = onEntityAdded(entityID, entity);
				} else {
					// was already present
				}

				if (gameObject instanceof StarSystemObject) {
					// if (entityID == $viewState.avatarID) {
					// 	gameObject.markAsPlayerControlled(true);
					// } else {
					// 	gameObject.markAsPlayerControlled(false);
					// }
				}

				// anyway we update the value
				updateEntity(entityID, gameObject, entity);
			}

			// Check for removals
			const avatarObjectIDs = gameObjects.keys();
			for (const avatarObjectID of avatarObjectIDs) {
				if (!processed.has(avatarObjectID)) {
					const gameObject = gameObjects.get(avatarObjectID);
					if (gameObject) {
						onEntityRemoved(avatarObjectID, gameObject);
					} else {
						console.error(`already removed ? ${avatarObjectID}`);
					}
				}
			}
		});
	}

	function onAppStopped() {
		unsubscribe?.();
	}

	return {
		onAppStarted,
		onAppStopped
	};
}

export const renderer = createRenderer(viewState);

export type Renderer = ReturnType<typeof createRenderer>;
