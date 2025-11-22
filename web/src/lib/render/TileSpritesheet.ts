import { Assets, Texture } from 'pixi.js';

export enum TileType {
	Empty = 0,
	Wall = 1,
	Box = 2,
	Exit = 3,
	WallDepth = 4, // Wall that should appear above characters
	BoxDepth = 5, // Box that should appear above characters
	ExitDepth = 6 // Exit that should appear above characters
}

export class TileSpritesheet {
	private static textures: Map<TileType, Texture> = new Map();
	private static loaded = false;

	// Generate base64 encoded tile textures for immediate use
	private static createTileTexture(type: TileType): string {
		const canvas = document.createElement('canvas');
		canvas.width = 10;
		canvas.height = 10;
		const ctx = canvas.getContext('2d')!;

		switch (type) {
			case TileType.Wall:
				// Wall: gray with subtle border
				ctx.fillStyle = '#666666';
				ctx.fillRect(0, 0, 10, 10);
				ctx.strokeStyle = '#555555';
				ctx.lineWidth = 1;
				ctx.strokeRect(0.5, 0.5, 9, 9);
				break;

			case TileType.Box:
				// Box: brown with wood grain effect
				ctx.fillStyle = '#8B4513';
				ctx.fillRect(0, 0, 10, 10);
				ctx.strokeStyle = '#654321';
				ctx.lineWidth = 1;
				ctx.strokeRect(0.5, 0.5, 9, 9);
				// Add some wood grain lines
				ctx.strokeStyle = '#A0522D';
				ctx.lineWidth = 0.5;
				for (let i = 2; i < 8; i += 2) {
					ctx.beginPath();
					ctx.moveTo(1, i);
					ctx.lineTo(9, i + Math.sin(i) * 0.5);
					ctx.stroke();
				}
				break;

			case TileType.Exit:
				// Exit: red with border
				ctx.fillStyle = '#FF0000';
				ctx.fillRect(0, 0, 10, 10);
				ctx.strokeStyle = '#CC0000';
				ctx.lineWidth = 1;
				ctx.strokeRect(0.5, 0.5, 9, 9);
				// Add a subtle gradient effect
				const gradient = ctx.createLinearGradient(0, 0, 0, 10);
				gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
				gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, 10, 10);
				break;

			case TileType.WallDepth:
				// Wall with depth effect (brighter, appears above)
				ctx.fillStyle = '#777777';
				ctx.fillRect(0, 0, 10, 10);
				ctx.strokeStyle = '#666666';
				ctx.lineWidth = 1;
				ctx.strokeRect(0.5, 0.5, 9, 9);
				// Add highlight
				ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
				ctx.fillRect(1, 1, 8, 2);
				break;

			case TileType.BoxDepth:
				// Box with depth effect (brighter, appears above)
				ctx.fillStyle = '#A0522D';
				ctx.fillRect(0, 0, 10, 10);
				ctx.strokeStyle = '#8B4513';
				ctx.lineWidth = 1;
				ctx.strokeRect(0.5, 0.5, 9, 9);
				// Add highlight
				ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
				ctx.fillRect(1, 1, 8, 2);
				break;

			case TileType.ExitDepth:
				// Exit with depth effect (brighter, appears above)
				ctx.fillStyle = '#FF3333';
				ctx.fillRect(0, 0, 10, 10);
				ctx.strokeStyle = '#DD0000';
				ctx.lineWidth = 1;
				ctx.strokeRect(0.5, 0.5, 9, 9);
				// Add highlight
				ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
				ctx.fillRect(1, 1, 8, 2);
				break;
		}

		return canvas.toDataURL();
	}

	public static async load(): Promise<void> {
		if (this.loaded) return;

		const tileTypes = [
			TileType.Wall,
			TileType.Box,
			TileType.Exit,
			TileType.WallDepth,
			TileType.BoxDepth,
			TileType.ExitDepth
		];

		const loadPromises = tileTypes.map(async (type) => {
			const dataURL = this.createTileTexture(type);
			const alias = `tile_${type}`;

			Assets.add({
				alias,
				src: dataURL,
				data: {
					scaleMode: 'nearest'
				}
			});

			const texture = await Assets.load(alias);
			this.textures.set(type, texture);
		});

		await Promise.all(loadPromises);
		this.loaded = true;
	}

	public static getTexture(type: TileType): Texture | undefined {
		return this.textures.get(type);
	}

	public static isLoaded(): boolean {
		return this.loaded;
	}
}
