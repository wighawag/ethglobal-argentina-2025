import { Assets, BitmapText, Container } from 'pixi.js';

export class LoadingBitmapText extends Container {
	constructor(
		protected config: {
			text: string;
			style: {
				fontURL: string;
				fontFamily: string;
				fontSize?: number;
				fill?: string | number;
				wordWrap?: boolean;
				wordWrapWidth?: number;
			};
		}
	) {
		super();

		const self = this;

		Assets.load(config.style.fontURL)
			.then((t) => self.onLoaded(t))
			.catch((err) => {
				console.error(err);
			});
	}

	set text(t: string) {
		if (this.children.length >= 1) {
			(this.children[0] as BitmapText).text = t;
		}
	}
	get text(): string {
		if (this.children.length >= 1) {
			return (this.children[0] as BitmapText).text;
		} else {
			return '';
		}
	}

	onLoaded(t: any) {
		// console.log(`loaded`, t);
		const bitmapText = new BitmapText(this.config);
		this.addChild(bitmapText);
	}
}
