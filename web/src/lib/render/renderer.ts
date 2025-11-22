import { viewState, type ViewEntity, type ViewState } from '$lib/view';
import { Container, Graphics } from 'pixi.js';
import type { Readable } from 'svelte/store';
import { AvatarObject } from './objects/AvatarObject';
import { WallRenderer } from './WallRenderer';
import { camera } from './camera';
import type { GameObject } from './objects/GameObject';

export function createRenderer(viewState: Readable<ViewState>) {
	let gameObjects: { [id: string]: GameObject } = {};
	let unsubscribe: (() => void) | undefined = undefined;
	let wallRenderer: WallRenderer | undefined = undefined;
	let cameraUnsubscribe: (() => void) | undefined = undefined;

	async function onAppStarted(container: Container) {
		let pathDisplayObject = new Container();
		container.addChild(pathDisplayObject);
		pathDisplayObject.zIndex = 1;

		// Initialize wall renderer
		const cellSize = 10; // Same as in PixiCanvas
		wallRenderer = new WallRenderer(container, cellSize);
		wallRenderer.zIndex = 0; // Render walls behind avatars

		// Initialize the spritesheet for the WallRenderer
		await wallRenderer.initialize();

		const world = {
			pathDisplayObject
		};

		// Subscribe to camera changes for wall rendering
		cameraUnsubscribe = camera.subscribe(($camera) => {
			if (wallRenderer) {
				wallRenderer.update($camera);
			}
		});

		unsubscribe = viewState.subscribe(($viewState) => {
			const processed = new Set();

			function onEntityAdded(id: string, entity: ViewEntity): GameObject {
				if (entity.type == 'avatar') {
					// console.log(`avatar added ${entity.id}`);
					const avatarObject = new AvatarObject(world, entity);
					container.addChild(avatarObject);
					gameObjects[id] = avatarObject;
					return avatarObject;
				} else {
					throw new Error(`unknown object type : ${entity.type}`);
				}
			}

			function onEntityRemoved(id: string, gameObject: GameObject) {
				// console.log(`entity removed ${id}`);
				// TODO removal type ?
				gameObject.onRemoved();
				container.removeChild(gameObject);
				delete gameObjects[id];
			}

			function updateEntity(id: string, gameObject: GameObject, entity: ViewEntity) {
				gameObject.update(entity, $viewState.epoch);
			}

			const entityIDs = Object.keys($viewState.entities);
			for (const entityID of entityIDs) {
				processed.add(entityID);

				const entity = $viewState.entities[entityID];
				let gameObject = gameObjects[entityID];
				if (!gameObject) {
					gameObject = onEntityAdded(entityID, entity);
				} else {
					// was already present
				}

				if (gameObject instanceof AvatarObject) {
					if (entityID == $viewState.avatarID) {
						gameObject.markAsPlayerControlled(true);
					} else {
						gameObject.markAsPlayerControlled(false);
					}
				}

				// anyway we update the value
				updateEntity(entityID, gameObject, entity);
			}

			// Check for removals
			const avatarObjectIDs = Object.keys(gameObjects);
			for (const avatarObjectID of avatarObjectIDs) {
				if (!processed.has(avatarObjectID)) {
					onEntityRemoved(avatarObjectID, gameObjects[avatarObjectID]);
				}
			}
		});
	}

	function onAppStopped() {
		unsubscribe?.();
		cameraUnsubscribe?.();
		if (wallRenderer) {
			wallRenderer.destroy();
		}
	}

	return {
		onAppStarted,
		onAppStopped
	};
}

export const renderer = createRenderer(viewState);

export type Renderer = ReturnType<typeof createRenderer>;
