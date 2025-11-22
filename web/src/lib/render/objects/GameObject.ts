import type { ViewEntity } from '$lib/view';
import { Container } from 'pixi.js';

export abstract class GameObject extends Container {
	constructor() {
		super();
	}

	abstract update(entity: ViewEntity, epoch: number): void;

	abstract onRemoved(): void;
}
