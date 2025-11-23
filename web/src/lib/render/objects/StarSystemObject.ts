import { GameObject } from './GameObject';
import { Sprite, Assets, Graphics } from 'pixi.js';
import type { StarSystemViewEntity } from '$lib/view';

function getPlanetIndex(x: number, y: number): number {
	// Simple deterministic hash based on coordinates
	const hash = Math.abs(x * 374761393 + y * 668265263);
	return hash % 8; // 8 planets available (0-7)
}

export class StarSystemObject extends GameObject {
	protected playerControlled: boolean = false;
	private planetSprite: Sprite | null = null;
	private selectionGraphics: Graphics | null = null;
	private textureLoaded: boolean = false;

	constructor(protected entity: StarSystemViewEntity) {
		super();

		// Load and create planet sprite first (so it appears behind the selection)
		const planetIndex = getPlanetIndex(entity.position.x, entity.position.y);
		const planetPath = `/images/planet_${planetIndex}.png`;

		// Create sprite
		this.planetSprite = new Sprite();
		this.planetSprite.anchor.set(0.5); // Center the anchor point
		// this.planetSprite.visible = false; // Hide until texture loads
		this.addChild(this.planetSprite);

		// Create selection indicator (stroke) - add after sprite so it appears on top
		// this.selectionGraphics = new Graphics()
		// 	.rect(-5, -5, 10, 10)
		// 	.stroke({ width: 1, color: 0x00ff00 });
		// this.addChild(this.selectionGraphics);

		// Load the texture asynchronously
		Assets.load(planetPath)
			.then((texture) => {
				if (this.planetSprite && !this.destroyed) {
					this.planetSprite.texture = texture;
					this.textureLoaded = true;

					// Scale to appropriate size (20px max dimension)
					const scale = 8 / Math.max(texture.width, texture.height);
					this.planetSprite.scale.set(scale);

					// Make sprite visible if entity is active
					// this.planetSprite.visible = entity.isActive;

					console.log(
						`Loaded planet texture: ${planetPath}, scale: ${scale}, visible: ${entity.isActive}`
					);
				}
			})
			.catch((error) => {
				console.error(`Failed to load planet texture: ${planetPath}`, error);
			});
	}

	update(entity: StarSystemViewEntity, epoch: number) {
		this.entity = entity;

		if (this.playerControlled) {
			// Handle player controlled logic if needed
		}

		// Show/hide planet based on active state and texture loaded
		if (this.planetSprite && this.textureLoaded) {
			// this.planetSprite.visible = entity.isActive;
		}

		this.x = 10 * entity.position.x;
		this.y = 10 * entity.position.y;
	}

	markAsPlayerControlled(isPlayerControlled: boolean) {
		this.playerControlled = isPlayerControlled;
	}

	onRemoved() {
		// Clean up resources
		if (this.planetSprite) {
			this.planetSprite.destroy();
			this.planetSprite = null;
		}
		if (this.selectionGraphics) {
			this.selectionGraphics.destroy();
			this.selectionGraphics = null;
		}
	}
}
