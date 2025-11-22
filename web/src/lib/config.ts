import { version } from '$app/environment';
import deployments from './deployments';
import { gasFee } from './onchain/gasFee';
import { SpaceInfo } from './space';

function getBigIntPowerOf10(n: bigint) {
	if (n === 0n) return 1n; // Edge case: log10(0) is undefined, default to 10^0=1
	const numStr = n.toString();
	const numDigits = numStr.length;

	// Check if n is exactly a power of 10 (like 10, 100, 1000...)
	if (
		numStr[0] === '1' &&
		numStr
			.slice(1)
			.split('')
			.every((ch) => ch === '0')
	) {
		return 10n ** BigInt(numDigits - 1);
	} else {
		return 10n ** BigInt(numDigits);
	}
}

export const maxActionCost =
	BigInt(deployments.chain.properties.expectedWorstGasPrice) * 1_000_000n; // 1_000_000 per action is our limit
export const stippend = maxActionCost * 100n; // 100 turn, we need to show
export const price = BigInt(deployments.contracts.AvatarsSale.linkedData.paymentAmount);
export const creditsDivider = getBigIntPowerOf10(maxActionCost);

gasFee.subscribe(() => {});

console.log(`VERSION: ${version}`);

export const spaceInfo = new SpaceInfo(deployments.contracts.Game.linkedData);
