import { Container, Sprite } from 'pixi.js';
import type { Camera } from './camera';
import { areaAt, Areas, ZONE_SIZE } from 'dgame-contracts';
import { zoneLocalCoord } from 'dgame-contracts';
import { TileSpritesheet, TileType } from './TileSpritesheet';
import { TileSpritePool } from './SpritePool';
import { CellType, type AreaData } from './WallRenderer';

// Interface for tile positioning and type information
interface TileInfo {
	x: number;
	y: number;
	type: CellType;
	hasDepthEffect: boolean;
}

/**
 * Sprite-based WallRenderer implementation with depth effects and performance optimizations.
 *
 * Features:
 * - Uses sprites instead of graphics for better performance
 * - Sprite pooling to reduce memory allocation
 * - Depth effects to render tiles above characters
 * - Camera-based culling for optimization
 */
export class SpriteWallRenderer {
	private container: Container;
	private spritePool: TileSpritePool;
	private backgroundTilesContainer: Container;
	private foregroundTilesContainer: Container;
	private cellSize: number;
	private visibleTiles: Map<string, Sprite> = new Map();

	// zIndex for layering: background tiles behind characters, foreground tiles above
	public zIndex: number = 0;
	private backgroundZIndex = 0;
	private foregroundZIndex = 10; // Above avatars which are at zIndex 2

	constructor(container: Container, cellSize: number) {
		this.container = container;
		this.cellSize = cellSize;
		this.spritePool = new TileSpritePool();

		// Create containers for background and foreground tiles
		this.backgroundTilesContainer = new Container();
		this.foregroundTilesContainer = new Container();

		this.backgroundTilesContainer.zIndex = this.backgroundZIndex;
		this.foregroundTilesContainer.zIndex = this.foregroundZIndex;

		this.container.addChild(this.backgroundTilesContainer);
		this.container.addChild(this.foregroundTilesContainer);
	}

	private getCellAt(worldX: number, worldY: number): CellType {
		// Use the same zoneLocalCoord function as game operations
		const areaLocalX = zoneLocalCoord(worldX);
		const areaLocalY = zoneLocalCoord(worldY);
		const cellIndex = areaLocalX + areaLocalY * ZONE_SIZE;

		const area = areaAt(worldX, worldY);
		return area.cells[cellIndex] as CellType;
	}

	private getVisibleBounds(camera: Camera): {
		startX: number;
		endX: number;
		startY: number;
		endY: number;
	} {
		// Large margin to ensure no gaps at area boundaries
		const margin = 20;
		return {
			startX: Math.floor(camera.x - camera.width / 2 - margin),
			endX: Math.ceil(camera.x + camera.width / 2 + margin),
			startY: Math.floor(camera.y - camera.height / 2 - margin),
			endY: Math.ceil(camera.y + camera.height / 2 + margin)
		};
	}

	private getKey(x: number, y: number): string {
		return `${x},${y}`;
	}

	private shouldHaveDepthEffect(x: number, y: number): boolean {
		// Simple heuristic: tiles at higher y values (lower on screen) get depth effect
		// This can be made more sophisticated based on game logic
		return y > 50 || (x + y) % 10 === 0;
	}

	private getTileType(cellType: CellType, hasDepthEffect: boolean): TileType {
		switch (cellType) {
			case CellType.Wall:
				return hasDepthEffect ? TileType.WallDepth : TileType.Wall;
			case CellType.Box:
				return hasDepthEffect ? TileType.BoxDepth : TileType.Box;
			case CellType.Exit:
				return hasDepthEffect ? TileType.ExitDepth : TileType.Exit;
			default:
				return TileType.Empty;
		}
	}

	private getTilePosition(x: number, y: number): { x: number; y: number } {
		// Match the grid offset from PixiCanvas: -cellSize - cellSize/2 + (offset % cellSize)
		return {
			x: x * this.cellSize - this.cellSize / 2,
			y: y * this.cellSize - this.cellSize / 2
		};
	}

	private createTileSprite(tileInfo: TileInfo): Sprite {
		const hasDepthEffect = tileInfo.hasDepthEffect;
		const tileType = this.getTileType(tileInfo.type, hasDepthEffect);
		const sprite = this.spritePool.getSprite(tileType);

		const position = this.getTilePosition(tileInfo.x, tileInfo.y);
		sprite.x = position.x;
		sprite.y = position.y;
		sprite.width = this.cellSize;
		sprite.height = this.cellSize;

		// Add to appropriate container based on depth effect
		const targetContainer = hasDepthEffect
			? this.foregroundTilesContainer
			: this.backgroundTilesContainer;
		if (sprite.parent !== targetContainer) {
			targetContainer.addChild(sprite);
		}

		return sprite;
	}

	private removeTileSprite(key: string): void {
		const sprite = this.visibleTiles.get(key);
		if (sprite) {
			this.spritePool.returnSprite(sprite);
			this.visibleTiles.delete(key);
		}
	}

	async initialize(): Promise<void> {
		// Load the spritesheet before first use
		await TileSpritesheet.load();
	}

	update(camera: Camera) {
		const bounds = this.getVisibleBounds(camera);
		const newVisibleTiles: Map<string, TileInfo> = new Map();

		// Check each visible cell and collect tiles that should be visible
		for (let x = bounds.startX; x <= bounds.endX; x++) {
			for (let y = bounds.startY; y <= bounds.endY; y++) {
				const cellType = this.getCellAt(x, y);

				if (cellType !== CellType.Empty) {
					const key = this.getKey(x, y);
					const hasDepthEffect = this.shouldHaveDepthEffect(x, y);
					newVisibleTiles.set(key, {
						x,
						y,
						type: cellType,
						hasDepthEffect
					});
				}
			}
		}

		// Remove tiles that are no longer visible
		for (const [key, sprite] of this.visibleTiles.entries()) {
			if (!newVisibleTiles.has(key)) {
				this.removeTileSprite(key);
			}
		}

		// Add or update tiles that should be visible
		for (const [key, tileInfo] of newVisibleTiles.entries()) {
			let sprite = this.visibleTiles.get(key);

			if (!sprite) {
				// Create new sprite
				sprite = this.createTileSprite(tileInfo);
				this.visibleTiles.set(key, sprite);
			} else {
				// Update existing sprite if depth effect changed
				const currentHasDepth = this.foregroundTilesContainer.children.includes(sprite);
				if (currentHasDepth !== tileInfo.hasDepthEffect) {
					this.removeTileSprite(key);
					sprite = this.createTileSprite(tileInfo);
					this.visibleTiles.set(key, sprite);
				}
			}
		}
	}

	destroy() {
		// Return all sprites to pool and clean up
		this.spritePool.clear();
		this.visibleTiles.clear();

		this.container.removeChild(this.backgroundTilesContainer);
		this.container.removeChild(this.foregroundTilesContainer);
	}

	// Public getter for monitoring active tiles
	getActiveTileCount(): number {
		return this.visibleTiles.size;
	}
}
