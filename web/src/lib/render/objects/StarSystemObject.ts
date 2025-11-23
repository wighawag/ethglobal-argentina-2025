import { GameObject } from './GameObject';
import { Graphics } from 'pixi.js';
import type { StarSystemViewEntity } from '$lib/view';

export class StarSystemObject extends GameObject {
	protected playerControlled: boolean = false;

	constructor(protected entity: StarSystemViewEntity) {
		super();

		{
			const graphics = new Graphics().rect(-5, -5, 10, 10).stroke({ width: 1, color: 0x00ff00 });
			this.addChild(graphics);
		}

		{
			const graphics = new Graphics().rect(-5, -5, 10, 10).fill({ color: 0x00ff00 });
			this.addChild(graphics);
			graphics.visible = false;
		}
	}

	update(entity: StarSystemViewEntity, epoch: number) {
		this.entity = entity;

		if (this.playerControlled) {
		}

		if (entity.isActive) {
			this.children[1].visible = true;
		} else {
			this.children[1].visible = false;
		}

		this.x = 10 * entity.position.x;
		this.y = 10 * entity.position.y;
	}

	markAsPlayerControlled(isPlayerControlled: boolean) {
		this.playerControlled = isPlayerControlled;
	}

	onRemoved() {}
}
