<script lang="ts">
	import { Viewport } from 'pixi-viewport';
	import { Application, Container, FederatedPointerEvent, Graphics, Sprite } from 'pixi.js';
	import { initDevtools } from '@pixi/devtools';
	import { onMount } from 'svelte';
	import { type Writable } from 'svelte/store';
	import type { Camera, CameraWatcher } from './camera';
	import type { Renderer } from './renderer';
	import type { EventEnitter } from './eventEmitter';
	import { startListening, stopListening } from '$lib/operations';

	// import { gsap } from 'gsap';
	// import { PixiPlugin } from 'gsap/PixiPlugin';
	// register the plugin
	// gsap.registerPlugin(PixiPlugin);
	// // give the plugin a reference to the PIXI object
	// PixiPlugin.registerPIXI({
	// 	Container,
	// 	Sprite
	// 	// BlurFilter,
	// 	// ColorMatrixFilter
	// });

	interface Props {
		camera: CameraWatcher;
		renderer: Renderer;
		eventEmitter: EventEnitter;
	}
	let { camera, renderer, eventEmitter }: Props = $props();

	function buildGrid(graphics: Graphics, witdh: number, height: number, cellSize: number) {
		const numRows = Math.floor(height / cellSize) + 1;
		const numCols = Math.floor(witdh / cellSize) + 1;
		for (let i = 0; i < numCols; i++) {
			graphics.moveTo(i * cellSize, 0).lineTo(i * cellSize, height);
		}

		for (let i = 0; i < numRows; i++) {
			graphics.moveTo(0, i * cellSize).lineTo(witdh, i * cellSize);
		}

		return graphics;
	}

	let canvas: HTMLCanvasElement;
	let viewport: Viewport;
	onMount(() => {
		const cellSize = 10;

		const minWidth = 5 * cellSize;
		const minHeight = 5 * cellSize;
		const maxWidth = 50 * cellSize;
		const maxHeight = 50 * cellSize;

		let isDragging = false;
		let dragStartPos = { x: 0, y: 0 };
		let clickThreshold = 5; // pixels

		function onclick(event: FederatedPointerEvent) {
			// Only trigger click if we're not in a drag operation
			if (!isDragging) {
				const pos = viewport.toWorld(event.x, event.y);
				eventEmitter.emit('clicked', {
					x: Math.round(pos.x / cellSize),
					y: Math.round(pos.y / cellSize)
				});
			}
		}

		function onPointerDown(event: FederatedPointerEvent) {
			isDragging = false;
			dragStartPos = { x: event.x, y: event.y };
		}

		function onPointerMove(event: FederatedPointerEvent) {
			const deltaX = Math.abs(event.x - dragStartPos.x);
			const deltaY = Math.abs(event.y - dragStartPos.y);

			// If movement exceeds threshold, we're dragging
			if (deltaX > clickThreshold || deltaY > clickThreshold) {
				isDragging = true;
			}
		}

		function onPointerUp() {
			// Reset drag state after a short delay to ensure click event doesn't fire
			setTimeout(() => {
				isDragging = false;
			}, 10);
		}

		function resizeViewport() {
			viewport && viewport.resize();
		}
		const sizeObserver = new ResizeObserver(resizeViewport);
		sizeObserver.observe(canvas);
		console.log(`Mounting PixiCanvas......`);
		const app = new Application();
		initDevtools({ app });

		let initialised = false;
		const appInitialising = app.init({
			resizeTo: canvas,
			canvas,
			backgroundAlpha: 1,
			backgroundColor: 'black'
		});
		appInitialising.then(() => {
			initialised = true;
			// create viewport
			viewport = new Viewport({
				events: app.renderer.events, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
				allowPreserveDragOutside: true
			});
			camera.setViewPort(viewport);
			(globalThis as any).viewport = viewport;
			viewport.moveCenter(0, 0);

			renderer.onAppStarted(viewport);
			// TODO move this from here
			startListening();

			// add the viewport to the stage
			app.stage.addChild(viewport);

			// activate plugins
			viewport.drag().pinch().wheel().clampZoom({
				maxWidth,
				maxHeight,
				minHeight,
				minWidth
			});

			viewport.fit(true, 20 * cellSize, 20 * cellSize);

			const gridSize = Math.max(maxWidth, maxHeight) + 2 * cellSize;

			const gridPixel = buildGrid(new Graphics(), gridSize, gridSize, cellSize).stroke({
				color: 0xffffff,
				pixelLine: true,
				width: 1
			});
			viewport.moveCenter(0, 0);

			viewport.addChild(gridPixel);

			// Register pointer events for proper click/drag handling
			viewport.on('pointerdown', onPointerDown);
			viewport.on('pointermove', onPointerMove);
			viewport.on('pointerup', onPointerUp);
			viewport.on('click', onclick);
			viewport.on('tap', onclick);

			// const displayObject = new Container();
			// {
			// 	const graphics = new Graphics().rect(0, 0, 10, 10).fill(0x00ff00);
			// 	displayObject.addChild(graphics);
			// }

			// {
			// 	const graphics = new Graphics().rect(0, -40, 10, 90).fill(0xff0000);
			// 	displayObject.addChild(graphics);
			// 	graphics.visible = false;
			// }
			// {
			// 	const graphics = new Graphics().rect(-40, 0, 90, 10).fill(0xff0000);
			// 	displayObject.addChild(graphics);
			// 	graphics.visible = false;
			// }
			// {
			// 	const text = new LoadingBitmapText({
			// 		text: '1',
			// 		style: {
			// 			fontURL: 'https://pixijs.com/assets/bitmap-font/desyrel.xml',
			// 			fontFamily: 'Desyrel',
			// 			fontSize: 8,
			// 			fill: 'black'
			// 		}
			// 	});
			// 	text.x = 3;
			// 	text.y = -3;
			// 	displayObject.addChild(text);
			// }
			// viewport.addChild(displayObject);

			// Listen for animate update
			app.ticker.add((time) => {
				// Just for fun, let's rotate mr rabbit a little.
				// * Delta is 1 if running at 100% performance *
				// * Creates frame-independent transformation *
				// bunny.rotation += 0.1 * time.deltaTime;

				// Apply modulo to create an infinite scrolling grid that follows viewport
				// Get the current viewport position
				const viewportX = viewport.x;
				const viewportY = viewport.y;
				const scale = viewport.scaled;

				const offsetX = viewportX / scale;
				const offsetY = viewportY / scale;

				camera.update({
					x: viewport.center.x / cellSize,
					y: viewport.center.y / cellSize,
					width: viewport.worldScreenWidth / cellSize,
					height: viewport.worldScreenHeight / cellSize
				});

				gridPixel.x = -offsetX - cellSize - cellSize / 2 + (offsetX % cellSize);
				gridPixel.y = -offsetY - cellSize - cellSize / 2 + (offsetY % cellSize);

				gridPixel.alpha = viewport.scaled / 48;
			});
		});

		return () => {
			sizeObserver.disconnect();
			console.log(`Unmounting PixiCanvas...`);
			if (initialised) {
				console.log(`destroying Pixi Application...`);
				stopListening();
				renderer.onAppStopped();
				app.destroy();
			} else {
				console.log(`unmounting while app was not initialised, waiting for it...`);
				appInitialising.then(() => {
					console.log(`destroying Pixi Application...`);
					// try {
					stopListening();
					renderer.onAppStopped();
					// } finally {
					app.destroy();
					// }
				});
			}
		};
	});
</script>

<canvas id="arena" bind:this={canvas}></canvas>

<style>
	canvas {
		background-color: black;
		position: absolute;
		width: 100%;
		height: 100%;
		pointer-events: auto;
	}
</style>
