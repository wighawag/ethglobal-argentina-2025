import { writable, type Readable } from 'svelte/store';
import { Viewport } from 'pixi-viewport';

export type Camera = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type CameraWatcher = Readable<Camera> & {
	setViewPort(p: Viewport): void;
	update(values: Camera): void;
	follow(x: number, y: number): void;
};

let $camera = {
	x: 0,
	y: 0,
	width: 0,
	height: 0
};
const cameraStore = writable<Camera>($camera);

let viewport: Viewport | undefined;
export const camera: CameraWatcher = {
	subscribe: cameraStore.subscribe,
	setViewPort(p: Viewport) {
		viewport = p;
	},
	follow(x: number, y: number) {
		if (viewport) {
			viewport.moveCenter(x * 10, y * 10);
		}
	},
	update(values: Camera) {
		if (
			$camera.x != values.x ||
			$camera.y != values.y ||
			$camera.width != values.width ||
			$camera.height != values.height
		) {
			$camera = values;
			cameraStore.set($camera);
		}
	}
};
