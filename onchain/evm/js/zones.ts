export const ZONE_SIZE = 16;
export const ZONE_OFFSET = 8;

export function zoneCoord(a: number): number {
	if (a >= 0) {
		return Math.floor((a + ZONE_OFFSET) / ZONE_SIZE);
	} else {
		// For negative numbers, we want the next higher (less negative) integer
		// when we're exactly on a boundary like -24, -8, etc.
		return -Math.ceil((-a - ZONE_OFFSET) / ZONE_SIZE);
	}
}

export function zoneLocalCoord(x: number): number {
	const zone_coord = zoneCoord(x);
	if (zone_coord >= 0) {
		return x - (zone_coord * ZONE_SIZE - ZONE_OFFSET);
	} else {
		return x - (zone_coord * ZONE_SIZE - ZONE_OFFSET);
	}
}

export function wallAt(
	walls: readonly boolean[],
	x: number,
	y: number,
): boolean {
	const xx = zoneLocalCoord(x);
	const yy = zoneLocalCoord(y);
	const i = yy * ZONE_SIZE + xx;
	const wall = walls[i];
	if (wall == undefined) {
		return false;
	}
	return wall;
	// return ((walls >> (127n - i)) & 1n) == 1n;
}
