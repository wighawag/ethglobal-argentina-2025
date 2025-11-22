import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';

export class LoadingSVG extends Container {
	constructor(url: string) {
		super();
		const self = this;

		Assets.load({
			src: url,
			data: {
				parseAsGraphicsContext: true
			}
		})
			.then((t) => self.onLoaded(t))
			.catch((err) => {
				console.error(err);
			});
	}

	onLoaded(svg: any) {
		const graphics = new Graphics(svg);
		this.addChild(graphics);
	}
}
