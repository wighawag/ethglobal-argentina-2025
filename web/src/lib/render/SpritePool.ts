import { Sprite, Texture } from 'pixi.js';
import { TileType, TileSpritesheet } from './TileSpritesheet';

export class TileSpritePool {
	private pools: Map<TileType, Sprite[]> = new Map();
	private activeSprites: Set<Sprite> = new Set();

	constructor() {
		// Initialize pools for each tile type
		const tileTypes = [
			TileType.Wall,
			TileType.Box,
			TileType.Exit,
			TileType.WallDepth,
			TileType.BoxDepth,
			TileType.ExitDepth
		];

		for (const type of tileTypes) {
			this.pools.set(type, []);
		}
	}

	getSprite(type: TileType): Sprite {
		const pool = this.pools.get(type)!;
		let sprite = pool.pop();

		if (!sprite) {
			const texture = TileSpritesheet.getTexture(type);
			if (!texture) {
				throw new Error(`Texture not found for tile type: ${type}`);
			}
			sprite = new Sprite(texture);
			sprite.anchor.set(0); // Top-left anchor for grid positioning
		}

		sprite.visible = true;
		this.activeSprites.add(sprite);
		return sprite;
	}

	returnSprite(sprite: Sprite): void {
		if (this.activeSprites.has(sprite)) {
			this.activeSprites.delete(sprite);
			sprite.visible = false;
			sprite.parent?.removeChild(sprite);

			// Determine the sprite type based on its texture
			const type = this.getSpriteTypeFromTexture(sprite.texture);
			if (type !== undefined) {
				const pool = this.pools.get(type)!;
				pool.push(sprite);
			}
		}
	}

	private getSpriteTypeFromTexture(texture: Texture): TileType | undefined {
		// This is a simple implementation - in a more complex scenario,
		// you might want to store type metadata with each sprite
		for (const [type, sprites] of this.pools.entries()) {
			const texture_ref = TileSpritesheet.getTexture(type);
			if (texture_ref === texture) {
				return type;
			}
		}
		return undefined;
	}

	returnAll(): void {
		// Return all active sprites to their pools
		const spritesToReturn = Array.from(this.activeSprites);
		for (const sprite of spritesToReturn) {
			this.returnSprite(sprite);
		}
	}

	getActiveCount(): number {
		return this.activeSprites.size;
	}

	getPoolSize(type: TileType): number {
		return this.pools.get(type)?.length || 0;
	}

	clear(): void {
		this.returnAll();

		// Clear all pools
		for (const pool of this.pools.values()) {
			pool.length = 0;
		}
	}
}
