import { Container } from 'pixi.js';
import type { Camera } from './camera.js';
import {
	WallRendererType,
	isSpriteRendererEnabled,
	isDualGridRendererEnabled
} from './WallRendererConfig.js';

import { GraphicsWallRenderer } from './GraphicsWallRenderer.js';
import { DualGridWallRenderer } from './DualGridWallRenderer.js';
import { SpriteWallRenderer } from './SpriteWallRenderer.js';

// Cell types based on the ASCII parsing
export enum CellType {
	Empty = 0,
	Wall = 1,
	Box = 2,
	Exit = 3
}

export interface AreaData {
	cells: number[];
	size: number;
}

export interface WorldPosition {
	x: number;
	y: number;
}

/**
 * Unified WallRenderer facade that switches between sprite and graphics implementations.
 *
 * This class provides a single interface that can use either:
 * - Sprite-based rendering (recommended for performance and visual effects)
 * - Graphics-based rendering (original implementation, lower memory usage)
 *
 * Switch between implementations by changing WALL_RENDERER_TYPE in WallRendererConfig.ts
 */
export class WallRenderer {
	private renderer: SpriteWallRenderer | GraphicsWallRenderer | DualGridWallRenderer;
	public zIndex: number = 0;

	constructor(container: Container, cellSize: number) {
		if (isDualGridRendererEnabled()) {
			this.renderer = new DualGridWallRenderer(container, cellSize);
		} else if (isSpriteRendererEnabled()) {
			this.renderer = new SpriteWallRenderer(container, cellSize);
		} else {
			this.renderer = new GraphicsWallRenderer(container, cellSize);
		}
		this.zIndex = this.renderer.zIndex;
	}

	async initialize(): Promise<void> {
		// Only sprite and dual grid renderers need initialization
		if (
			this.renderer instanceof SpriteWallRenderer ||
			this.renderer instanceof DualGridWallRenderer
		) {
			await this.renderer.initialize();
		}
	}

	update(camera: Camera) {
		this.renderer.update(camera);
	}

	destroy() {
		this.renderer.destroy();
	}

	// Public getters for renderer-specific information
	getImplementationType(): WallRendererType {
		if (isDualGridRendererEnabled()) {
			return WallRendererType.DUAL_GRID;
		} else if (isSpriteRendererEnabled()) {
			return WallRendererType.SPRITE;
		} else {
			return WallRendererType.GRAPHICS;
		}
	}

	getActiveTileCount(): number {
		if (
			this.renderer instanceof SpriteWallRenderer ||
			this.renderer instanceof DualGridWallRenderer
		) {
			return this.renderer.getActiveTileCount();
		}
		return 0; // Graphics renderer doesn't track this
	}
}
