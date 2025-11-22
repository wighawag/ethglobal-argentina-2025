import { bigIntIDToXY, xyToBigIntID } from 'dgame-contracts';
import { encodePacked, keccak256 } from 'viem';
import { normal16, normal8, value8Mod } from './extraction.js';
import { uniqueName } from './names/uniqueName.js';

// object describing the static attributes of a planet // do not change
export type Statistics = {
	name: string;
	stake: number;
	production: number;
	attack: number;
	defense: number;
	speed: number;
	natives: number;
	subX: number;
	subY: number;
	cap: number;
	maxTravelingUpkeep: number;
};

// object including both planet id and global coordinates
export type PlanetLocation = {
	id: bigint;
	x: number; // not needed ?
	y: number; // not needed ?
	globalX: number;
	globalY: number;
};

// object representing a planet with only static attributes // do not change
export type PlanetInfo = {
	location: PlanetLocation;
	type: number;
	stats: Statistics;
};

// object representing the state of the planet // change over time and through actions
export type PlanetState = {
	empire?: string;
	lastUpdatedSaved: number; // updated
	numSpaceships: number;
	active: boolean;
};

export type Config = {
	readonly genesisHash: `0x${string}`;
	readonly acquireNumSpaceships: number;
	readonly productionCapAsDuration: number;
	readonly timePerDistance: number;
	readonly stakeRange: string;
	readonly stakeRangeArray: number[];
	readonly stakeMultiplier10000th: number;
};

function skip(): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, 1);
	});
}
function hours(numHours: number): number {
	return 60 * 60 * numHours;
}
function days(n: number): number {
	return hours(n * 24);
}

export class SpaceInfo {
	private readonly planetCache: Map<bigint, PlanetInfo | null> = new Map();

	public readonly config: Config;
	constructor(config: Config) {
		this.config = config;
	}

	getPlanetIDsInRect(x0: number, y0: number, x1: number, y1: number): bigint[] {
		const ids = [];
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {
				const planet = this.getPlanetInfo(x, y);
				if (planet) {
					ids.push(planet.location.id);
				}
			}
		}
		return ids;
	}

	getPlanetInfosInRect(x0: number, y0: number, x1: number, y1: number): PlanetInfo[] {
		const planets = [];
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {
				const planet = this.getPlanetInfo(x, y);
				if (planet) {
					planets.push(planet);
				}
			}
		}
		return planets;
	}

	*yieldPlanetsFromRect(
		x0: number,
		y0: number,
		x1: number,
		y1: number
	): Generator<PlanetInfo, void> {
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {
				const planet = this.getPlanetInfo(x, y);
				if (planet) {
					yield planet;
				}
			}
		}
	}

	async getPlanetIDsInRectAsync(
		x0: number,
		y0: number,
		x1: number,
		y1: number
	): Promise<PlanetInfo[]> {
		const planets = [];
		let i = 0;
		for (const planet of this.yieldPlanetsFromRect(x0, y0, x1, y1)) {
			planets.push(planet);
			i++;
			if (i % 6 == 0) {
				await skip(); // TODO use worker instead
			}
		}
		return planets;
	}

	getPlanetInfoViaId(id: bigint): PlanetInfo | undefined {
		const inCache = this.planetCache.get(id);
		if (typeof inCache !== 'undefined') {
			if (inCache === null) {
				return undefined;
			}
			return inCache;
		}
		const { x, y } = bigIntIDToXY(id);
		return this.getPlanetInfo(x, y);
	}

	getPlanetInfo(x: number, y: number): PlanetInfo | undefined {
		const id = xyToBigIntID(x, y);
		const inCache = this.planetCache.get(id);
		if (typeof inCache !== 'undefined') {
			if (inCache === null) {
				return undefined;
			}
			return inCache;
		}

		const location = xyToBigIntID(x, y);

		const data = keccak256(
			encodePacked(['bytes32', 'uint256'], [this.config.genesisHash, location])
		);

		const hasPlanet = value8Mod(data, 52, 16) == 1;
		if (!hasPlanet) {
			this.planetCache.set(id, null);
			return undefined;
		}

		const subX = 1 - value8Mod(data, 0, 3);
		const subY = 1 - value8Mod(data, 2, 3);

		const productionIndex = normal8(data, 12);
		const stakeIndex = productionIndex;
		const stake = Math.floor(
			this.config.stakeRangeArray[stakeIndex] * this.config.stakeMultiplier10000th
		);
		// console.log({stake});
		const production = normal16(
			data,
			12,
			'0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0'
		);
		const attackRoll = normal8(data, 20);
		const attack = 4000 + attackRoll * 400;
		const defenseRoll = normal8(data, 28);
		const defense = 4000 + defenseRoll * 400;
		const speedRoll = normal8(data, 36);
		const speed = 5005 + speedRoll * 333;
		const natives = 15000 + normal8(data, 44) * 3000;

		// const type = value8Mod(data, 60, 23);
		const attackGrade = attackRoll < 6 ? 0 : attackRoll < 10 ? 1 : 2;
		const defenseGrade = defenseRoll < 6 ? 0 : defenseRoll < 10 ? 1 : 2;
		const speedGrade = speedRoll < 6 ? 0 : speedRoll < 10 ? 1 : 2;

		const type = attackGrade * 9 + defenseGrade * 3 + speedGrade;

		const name = uniqueName(2, location);

		const planetObj = {
			location: {
				id: location,
				x,
				y,
				globalX: x * 4 + subX,
				globalY: y * 4 + subY
			},
			type,
			stats: {
				name,
				stake,
				production,
				attack,
				defense,
				speed,
				natives,
				subX,
				subY,
				maxTravelingUpkeep: Math.floor(
					this.config.acquireNumSpaceships +
						(production * this.config.productionCapAsDuration) / hours(1)
				),
				cap: Math.floor(
					this.config.acquireNumSpaceships +
						(production * this.config.productionCapAsDuration) / hours(1)
				)
			}
		};
		// console.log(JSON.stringify(planetObj);
		this.planetCache.set(id, planetObj);
		return planetObj;
	}

	// findNextPlanet(
	// 	pointer?: LocationPointer<PlanetInfo> | StrictLocationPointer<PlanetInfo>
	// ): StrictLocationPointer<PlanetInfo> {
	// 	do {
	// 		pointer = nextInSpiral(pointer);
	// 		pointer.data = this.getPlanetInfo(pointer.x, pointer.y);
	// 	} while (!pointer.data);
	// 	return pointer as StrictLocationPointer<PlanetInfo>;
	// }

	timeLeft(
		time: number,
		fromPlanet: PlanetInfo,
		toPlanet: PlanetInfo,
		startTime: number
	): { timeLeft: number; timePassed: number; fullTime: number } {
		const speed = fromPlanet.stats.speed;
		const fullDistance = this.distance(fromPlanet, toPlanet);
		const fullTime = Math.floor(fullDistance * ((this.config.timePerDistance * 10000) / speed));
		const timePassed = time - startTime;
		const timeLeft = fullTime - timePassed;
		return { timeLeft, timePassed, fullTime };
	}

	distance(fromPlanet: PlanetInfo, toPlanet: PlanetInfo): number {
		const gFromX = fromPlanet.location.globalX;
		const gFromY = fromPlanet.location.globalY;
		const gToX = toPlanet.location.globalX;
		const gToY = toPlanet.location.globalY;

		const fullDistance = Math.floor(
			Math.sqrt(Math.pow(gToX - gFromX, 2) + Math.pow(gToY - gFromY, 2))
		);
		return fullDistance;
	}

	timeToArrive(fromPlanet: PlanetInfo, toPlanet: PlanetInfo): number {
		return this.timeLeft(0, fromPlanet, toPlanet, 0).timeLeft;
	}
}
