import {expect} from 'earl';
import {describe, it} from 'node:test'; // using node:test as hardhat v3 do not support vitest
import {network} from 'hardhat';
import {setupFixtures} from './utils/index.js';
import {decodeEventLog, encodeAbiParameters, zeroAddress} from 'viem';

const {provider, networkHelpers, viem} = await network.connect();
const {deployAll} = setupFixtures(provider);

describe('Game', function () {
	it('basic test', async function () {
		const {
			env,
			Game,
			Avatars,
			AvatarsSale,
			unnamedAccounts,
			advanceToEpoch,
			advanceToRevealPhase,
			getEpoch,
			getTimestamp,
		} = await networkHelpers.loadFixture(deployAll);

		const timestamp = await getTimestamp();
		const {epoch: initialEpoch, commiting: initialCommiting} =
			getEpoch(timestamp);

		const avatarSubID = 0n;
		const avatarID = (BigInt(unnamedAccounts[0]) << 96n) + avatarSubID;

		const empireSubID = 0n;
		const empireID = (BigInt(unnamedAccounts[0]) << 96n) + empireSubID;
		console.log({
			Game: Game.address,
			avatarID,
			value: BigInt(AvatarsSale.linkedData!.paymentAmount as string),
		});
		await env.execute(AvatarsSale, {
			account: env.unnamedAccounts[0],
			functionName: 'purchase',
			args: [
				Game.address,
				avatarSubID,
				encodeAbiParameters(
					[{type: 'uint256'}, {type: 'address'}, {type: 'address'}],
					[empireSubID, unnamedAccounts[0], unnamedAccounts[0]],
				),
				zeroAddress,
				0n,
				zeroAddress,
			],
			value: BigInt(AvatarsSale.linkedData!.paymentAmount as string),
		});

		await advanceToEpoch(initialEpoch + 2);
		const entrancePosition = 0n;
		const hash = '0x000000000000000000000000000000000000000000000000';
		const secret =
			'0x0000000000000000000000000000000000000000000000000000000000000000';
		await env.execute(Game, {
			account: env.unnamedAccounts[0],
			functionName: 'commit',
			args: [avatarID, hash, zeroAddress],
		});

		await advanceToRevealPhase(initialEpoch + 2);

		await env.execute(Game, {
			account: env.unnamedAccounts[0],
			functionName: 'reveal',
			args: [
				avatarID,
				[{actionType: 0, data: entrancePosition}],
				secret,
				zeroAddress,
			],
		});

		await advanceToEpoch(initialEpoch + 3);

		await env.execute(Game, {
			account: env.unnamedAccounts[0],
			functionName: 'commit',
			args: [avatarID, hash, zeroAddress],
		});

		await advanceToRevealPhase(initialEpoch + 3);

		await env.execute(Game, {
			account: env.unnamedAccounts[0],
			functionName: 'reveal',
			args: [
				avatarID,
				[
					{actionType: 1, data: 4n},
					{actionType: 1, data: 4n},
				],
				secret,
				zeroAddress,
			],
		});
		// DONE
	});
});
