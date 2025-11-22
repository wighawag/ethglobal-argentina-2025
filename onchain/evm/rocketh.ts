// ------------------------------------------------------------------------------------------------
// Typed Config
// ------------------------------------------------------------------------------------------------
import type {UserConfig} from 'rocketh';

export const config = {
	chains: {
		31337: {
			properties: {
				expectedWorstGasPrice: parseEther('1', 'gwei'), // TODO use same value from hardhat config
			},
			tags: ['local', 'memory', 'testnet'],
		},
		6342: {
			properties: {
				// mega-eth testnet
				expectedWorstGasPrice: parseEther('0.003', 'gwei'),
			},
		},
		50312: {
			properties: {
				// somnia testnet
				expectedWorstGasPrice: parseEther('3', 'gwei'),
			},
		},
		11142220: {
			properties: {
				// celo sepolia testnet
				expectedWorstGasPrice: parseEther('25', 'gwei'),
			},
		},
		['cronos-testnet']: {
			deterministicDeployment: {
				deployer: '0x40f46c02D01bf02c703F7ABD0d7923F3A956515C',
				factory: '0x2B8f8bFdE1fF66616E7279F6f7069AF8E00f76A8',
				funding: '50000000000000000',
				signedTx:
					'0xf9043e8085746a528800830186a08080b903e96080604052348015600f57600080fd5b506103ca8061001f6000396000f3fe6080604052600436106100295760003560e01c8063360d0fad1461002e5780639881d19514610077575b600080fd5b34801561003a57600080fd5b5061004e610049366004610228565b61008a565b60405173ffffffffffffffffffffffffffffffffffffffff909116815260200160405180910390f35b61004e61008536600461029c565b6100ee565b6040517fffffffffffffffffffffffffffffffffffffffff000000000000000000000000606084901b166020820152603481018290526000906054016040516020818303038152906040528051906020012091506100e78261014c565b9392505050565b6040517fffffffffffffffffffffffffffffffffffffffff0000000000000000000000003360601b166020820152603481018290526000906054016040516020818303038152906040528051906020012091506100e734848461015e565b600061015882306101ce565b92915050565b60006f67363d3d37363d34f03d5260086018f3600052816010806000f58061018e5763301164256000526004601cfd5b8060145261d69460005260016034536017601e20915060008085516020870188855af1823b026101c65763301164256000526004601cfd5b509392505050565b60006040518260005260ff600b53836020527f21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f6040526055600b20601452806040525061d694600052600160345350506017601e20919050565b6000806040838503121561023b57600080fd5b823573ffffffffffffffffffffffffffffffffffffffff8116811461025f57600080fd5b946020939093013593505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600080604083850312156102af57600080fd5b823567ffffffffffffffff8111156102c657600080fd5b8301601f810185136102d757600080fd5b803567ffffffffffffffff8111156102f1576102f161026d565b6040517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0603f7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f8501160116810181811067ffffffffffffffff8211171561035d5761035d61026d565b60405281815282820160200187101561037557600080fd5b816020840160208301376000602092820183015296940135945050505056fea264697066735822122059dcc5dc6453397d13ff28021e28472a80a45bbd97f3135f69bd2650773aeb0164736f6c634300081a00338202c7a01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820',
			},
		},
	},
	defaultChainProperties: {
		// if not specified, fallback on:
		expectedWorstGasPrice: parseEther('0.000001', 'gwei'),
	},
	accounts: {
		deployer: {
			default: 0,
		},
		admin: {
			default: 0, // TODO
		},
	},
	data: {
		sale: {
			default: {
				price: parseEther('0.00000001'),
			},
		},
		Game: {
			'celos-epolia': {
				commitPhaseDuration: 35n,
				revealPhaseDuration: 10n,
				numMoves: 10n,
			},
			default: {
				commitPhaseDuration: 20n,
				revealPhaseDuration: 3n,
				numMoves: 10n,
			},
		},
	},
} as const satisfies UserConfig;

// ------------------------------------------------------------------------------------------------
// Imports and Re-exports
// ------------------------------------------------------------------------------------------------
// We regroup all what is needed for the deploy scripts
// so that they just need to import this file
// We also added an alias (#rocketh) in package.json's imports
// so they just need to do `import {deployScript, artifacts} from '#rocketh';`
// and this work anywhere in the file hierarchy
// ------------------------------------------------------------------------------------------------
// we add here the module we need, so that they are available in the deploy scripts
import * as deployExtension from '@rocketh/deploy'; // this one provide a deploy function
import * as readExecuteExtension from '@rocketh/read-execute'; // this one provide read,execute functions
import * as deployProxyExtension from '@rocketh/proxy'; // this one provide a deployViaProxy function that let you declaratively deploy proxy based contracts
import * as deployRouterExtension from '@rocketh/router'; // this one provide a deployViaProxy function that let you declaratively deploy proxy based contracts
const extensions = {
	...deployExtension,
	...readExecuteExtension,
	...deployProxyExtension,
	...deployRouterExtension,
};
// ------------------------------------------------------------------------------------------------
// we re-export the artifacts, so they are easily available from the alias
import * as artifacts from './generated/artifacts/index.js';
export {artifacts};
// ------------------------------------------------------------------------------------------------
// we create the rocketh functions we need by passing the extensions to the setup function
import {setup} from 'rocketh';
const {deployScript, loadAndExecuteDeployments} = setup<
	typeof extensions,
	typeof config.accounts,
	typeof config.data
>(extensions);
// ------------------------------------------------------------------------------------------------
// we do the same for hardhat-deploy
import {setupHardhatDeploy} from 'hardhat-deploy/helpers';
import {parseEther} from 'viem';
const {loadEnvironmentFromHardhat} = setupHardhatDeploy(extensions);
// ------------------------------------------------------------------------------------------------
// finally we export them
// - loadAndExecuteDeployments can be used in tests to ensure deployed contracts are available there
// - deployScript is the function used to create deploy script, see deploy/ folder
// - loadEnvironmentFromHardhat can be used in scripts and reuse hardhat network handling without deploying the contracts
export {loadAndExecuteDeployments, deployScript, loadEnvironmentFromHardhat};
