import { Container, Graphics } from 'pixi.js';
import type { Camera } from './camera';
import { areaAt, Areas, ZONE_SIZE } from 'dgame-contracts';
import { zoneLocalCoord } from 'dgame-contracts';
import { CellType, type AreaData } from './WallRenderer';

/**
 * Original graphics-based WallRenderer implementation.
 * This uses Graphics objects for rendering walls, boxes, and exits.
 *
 * NOTE: This implementation has been preserved as an alternative to the sprite-based version.
 * It may have lower performance but uses less memory and doesn't require texture loading.
 */
export class GraphicsWallRenderer {
	private container: Container;
	private wallGraphics: Graphics;
	private boxGraphics: Graphics;
	private exitGraphics: Graphics;
	private cellSize: number;
	// private visibleWalls: Set<string> = new Set();
	// private visibleBoxes: Set<string> = new Set();
	// private visibleExits: Set<string> = new Set();

	public zIndex: number = 0;

	constructor(container: Container, cellSize: number) {
		this.container = container;
		this.cellSize = cellSize;

		// Create graphics for walls and boxes
		this.wallGraphics = new Graphics();
		this.boxGraphics = new Graphics();
		this.exitGraphics = new Graphics();
		this.container.addChild(this.wallGraphics);
		this.container.addChild(this.boxGraphics);
		this.container.addChild(this.exitGraphics);
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

	private drawWall(x: number, y: number) {
		// Match the grid offset from PixiCanvas: -cellSize - cellSize/2 + (offset % cellSize)
		const pixelX = x * this.cellSize - this.cellSize / 2;
		const pixelY = y * this.cellSize - this.cellSize / 2;

		this.wallGraphics.rect(pixelX, pixelY, this.cellSize, this.cellSize).fill(0x666666);
	}

	private drawBox(x: number, y: number) {
		// Match the grid offset from PixiCanvas: -cellSize - cellSize/2 + (offset % cellSize)
		const pixelX = x * this.cellSize - this.cellSize / 2;
		const pixelY = y * this.cellSize - this.cellSize / 2;

		this.boxGraphics.rect(pixelX, pixelY, this.cellSize, this.cellSize).fill(0x8b4513);
	}

	private drawExit(x: number, y: number) {
		// Match the grid offset from PixiCanvas: -cellSize - cellSize/2 + (offset % cellSize)
		const pixelX = x * this.cellSize - this.cellSize / 2;
		const pixelY = y * this.cellSize - this.cellSize / 2;

		this.exitGraphics.rect(pixelX, pixelY, this.cellSize, this.cellSize).fill(0xff0000);
	}

	private clearWalls() {
		this.wallGraphics.clear();
	}

	private clearBoxes() {
		this.boxGraphics.clear();
	}

	private clearExits() {
		this.exitGraphics.clear();
	}

	async initialize(): Promise<void> {
		// Graphics renderer doesn't need initialization
		return Promise.resolve();
	}

	update(camera: Camera) {
		const bounds = this.getVisibleBounds(camera);
		// const newWalls: Set<string> = new Set();
		// const newBoxes: Set<string> = new Set();
		// const newExits: Set<string> = new Set();

		// Clear old graphics and start fresh
		this.clearWalls();
		this.clearBoxes();
		this.clearExits();

		// Check each visible cell
		for (let x = bounds.startX; x <= bounds.endX; x++) {
			for (let y = bounds.startY; y <= bounds.endY; y++) {
				const cellType = this.getCellAt(x, y);
				// const key = this.getKey(x, y);

				if (cellType === CellType.Wall) {
					this.drawWall(x, y);
					// newWalls.add(key);
				} else if (cellType === CellType.Box) {
					this.drawBox(x, y);
					// newBoxes.add(key);
				} else if (cellType === CellType.Exit) {
					this.drawExit(x, y);
					// newExits.add(key);
				}
			}
		}

		// this.visibleWalls = newWalls;
		// this.visibleBoxes = newBoxes;
		// this.visibleExits = newExits;
	}

	destroy() {
		this.container.removeChild(this.wallGraphics);
		this.container.removeChild(this.boxGraphics);
		this.wallGraphics.destroy();
		this.boxGraphics.destroy();
	}

	// Public getter for monitoring (returns 0 for graphics renderer)
	getActiveTileCount(): number {
		return 0; // Graphics renderer doesn't track this
	}
}
