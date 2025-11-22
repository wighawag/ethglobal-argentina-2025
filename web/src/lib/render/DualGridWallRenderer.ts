import { Container, Sprite } from 'pixi.js';
import type { Camera } from './camera';
import { areaAt, Areas, ZONE_SIZE } from 'dgame-contracts';
import { zoneLocalCoord } from 'dgame-contracts';
import { TileSpritesheet, TileType } from './TileSpritesheet';
import { TileSpritePool } from './SpritePool';
import { CellType, type AreaData } from './WallRenderer';

// Corner positions for dual grid system
enum Corner {
	TopLeft = 0,
	TopRight = 1,
	BottomLeft = 2,
	BottomRight = 3
}

// Interface for corner-based tile positioning
interface CornerTile {
	x: number;
	y: number;
	corner: Corner;
	type: CellType;
}

// Interface for tile position information
interface TilePosition {
	worldX: number;
	worldY: number;
	type: CellType;
	cornerTiles: CornerTile[];
}

/**
 * Dual Grid WallRenderer implementation with corner-based rendering.
 *
 * This system uses:
 * - Game Grid: Current wall/box/exit logic for game mechanics
 * - Visual Grid: Corner-based sprites (4 corners per position) for smooth blending
 *
 * Each logical tile position is rendered as 4 corner sprites instead of 1,
 * allowing for better visual transitions and smoother edges.
 */
export class DualGridWallRenderer {
	private container: Container;
	private spritePool: TileSpritePool;
	private tileLayers: Map<CellType, Container> = new Map();
	private cellSize: number;
	private visibleCornerTiles: Map<string, Sprite> = new Map();

	// Corner-based sprite positioning offsets
	private cornerOffsets = {
		[Corner.TopLeft]: { x: 0, y: 0 },
		[Corner.TopRight]: { x: 0.5, y: 0 },
		[Corner.BottomLeft]: { x: 0, y: 0.5 },
		[Corner.BottomRight]: { x: 0.5, y: 0.5 }
	};

	// zIndex for layering different cell types
	private layerZIndex = {
		[CellType.Empty]: -1,
		[CellType.Wall]: 1,
		[CellType.Box]: 2,
		[CellType.Exit]: 3
	};

	public zIndex: number = 0;

	constructor(container: Container, cellSize: number) {
		this.container = container;
		this.cellSize = cellSize;
		this.spritePool = new TileSpritePool();

		// Create separate layers for each cell type to avoid texture switching
		this.createTileLayers();
	}

	private createTileLayers() {
		const cellTypes = [CellType.Empty, CellType.Wall, CellType.Box, CellType.Exit];

		cellTypes.forEach((cellType) => {
			const layer = new Container();
			layer.zIndex = this.layerZIndex[cellType];
			this.tileLayers.set(cellType, layer);
			this.container.addChild(layer);
		});
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

	private getKey(x: number, y: number, corner: Corner): string {
		return `${x},${y},${corner}`;
	}

	private getTilePosition(x: number, y: number): { x: number; y: number } {
		// Match the grid offset from PixiCanvas: -cellSize - cellSize/2 + (offset % cellSize)
		return {
			x: x * this.cellSize - this.cellSize / 2,
			y: y * this.cellSize - this.cellSize / 2
		};
	}

	private getCornerPosition(x: number, y: number, corner: Corner): { x: number; y: number } {
		const basePosition = this.getTilePosition(x, y);
		const offset = this.cornerOffsets[corner];

		return {
			x: basePosition.x + offset.x * this.cellSize,
			y: basePosition.y + offset.y * this.cellSize
		};
	}

	private getCornerTileType(cellType: CellType): TileType {
		// Map cell types to existing tile types
		switch (cellType) {
			case CellType.Wall:
				return TileType.Wall;
			case CellType.Box:
				return TileType.Box;
			case CellType.Exit:
				return TileType.Exit;
			case CellType.Empty:
			default:
				return TileType.Empty;
		}
	}

	private getSurroundingCellTypes(
		x: number,
		y: number
	): { top: CellType; right: CellType; bottom: CellType; left: CellType } {
		return {
			top: this.getCellAt(x, y - 1),
			right: this.getCellAt(x + 1, y),
			bottom: this.getCellAt(x, y + 1),
			left: this.getCellAt(x - 1, y)
		};
	}

	private shouldRenderCorner(x: number, y: number, corner: Corner): boolean {
		// Determine if a corner should be rendered based on neighboring tiles
		// This creates the dual grid effect where corners blend smoothly

		const centerType = this.getCellAt(x, y);
		const neighbors = this.getSurroundingCellTypes(x, y);

		// Simple implementation: render corners based on neighboring tile types
		// This can be made more sophisticated later
		switch (corner) {
			case Corner.TopLeft:
				return (
					centerType !== CellType.Empty ||
					neighbors.top !== CellType.Empty ||
					neighbors.left !== CellType.Empty
				);
			case Corner.TopRight:
				return (
					centerType !== CellType.Empty ||
					neighbors.top !== CellType.Empty ||
					neighbors.right !== CellType.Empty
				);
			case Corner.BottomLeft:
				return (
					centerType !== CellType.Empty ||
					neighbors.bottom !== CellType.Empty ||
					neighbors.left !== CellType.Empty
				);
			case Corner.BottomRight:
				return (
					centerType !== CellType.Empty ||
					neighbors.bottom !== CellType.Empty ||
					neighbors.right !== CellType.Empty
				);
			default:
				return true;
		}
	}

	private createCornerTile(cornerTile: CornerTile): Sprite {
		const tileType = this.getCornerTileType(cornerTile.type);
		const sprite = this.spritePool.getSprite(tileType);

		const position = this.getCornerPosition(cornerTile.x, cornerTile.y, cornerTile.corner);
		sprite.x = position.x;
		sprite.y = position.y;
		sprite.width = this.cellSize / 2; // Half size for corner
		sprite.height = this.cellSize / 2; // Half size for corner

		// Add to appropriate layer based on cell type
		const layer = this.tileLayers.get(cornerTile.type)!;
		if (sprite.parent !== layer) {
			layer.addChild(sprite);
		}

		return sprite;
	}

	private removeCornerTile(key: string): void {
		const sprite = this.visibleCornerTiles.get(key);
		if (sprite) {
			this.spritePool.returnSprite(sprite);
			this.visibleCornerTiles.delete(key);
		}
	}

	async initialize(): Promise<void> {
		// Load the spritesheet before first use
		await TileSpritesheet.load();
	}

	update(camera: Camera) {
		const bounds = this.getVisibleBounds(camera);
		const newVisibleCornerTiles: Map<string, CornerTile> = new Map();

		// Check each visible cell and collect corner tiles that should be visible
		for (let x = bounds.startX; x <= bounds.endX; x++) {
			for (let y = bounds.startY; y <= bounds.endY; y++) {
				const cellType = this.getCellAt(x, y);

				if (cellType !== CellType.Empty) {
					// For each corner of this tile
					for (let corner = 0; corner < 4; corner++) {
						if (this.shouldRenderCorner(x, y, corner as Corner)) {
							const key = this.getKey(x, y, corner as Corner);
							newVisibleCornerTiles.set(key, {
								x,
								y,
								corner: corner as Corner,
								type: cellType
							});
						}
					}
				}
			}
		}

		// Remove corner tiles that are no longer visible
		for (const key of this.visibleCornerTiles.keys()) {
			if (!newVisibleCornerTiles.has(key)) {
				this.removeCornerTile(key);
			}
		}

		// Add or update corner tiles that should be visible
		for (const [key, cornerTile] of newVisibleCornerTiles.entries()) {
			let sprite = this.visibleCornerTiles.get(key);

			if (!sprite) {
				// Create new corner sprite
				sprite = this.createCornerTile(cornerTile);
				this.visibleCornerTiles.set(key, sprite);
			}
			// Note: Corner sprites don't need position updates since camera movement
			// is handled by parent container transformation
		}
	}

	destroy() {
		// Return all corner sprites to pool and clean up
		this.spritePool.clear();
		this.visibleCornerTiles.clear();

		// Remove all tile layers
		for (const [cellType, layer] of this.tileLayers.entries()) {
			this.container.removeChild(layer);
		}
		this.tileLayers.clear();
	}

	// Public getter for monitoring active corner tiles
	getActiveTileCount(): number {
		return this.visibleCornerTiles.size;
	}
}
