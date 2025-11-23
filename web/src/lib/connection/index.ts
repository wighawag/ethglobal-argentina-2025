import { PUBLIC_WALLET_HOST } from '$env/static/public';
import { createConnection } from '@etherplay/connect';
import deployments from '$lib/deployments';
import { createPublicClient, createWalletClient, custom } from 'viem';
import { derived } from 'svelte/store';
import {
	EthereumWalletConnector,
	EthereumWalletProvider
} from '@etherplay/wallet-connector-ethereum';
import sdk from '@farcaster/miniapp-sdk';

class FarcasterWalletConnector extends EthereumWalletConnector {
	farcasterHandle: any;
	override fetchWallets(walletAnnounced: (walletInfo: any) => void): void {
		sdk.context
			.then((context) => {
				if (context?.user?.fid) {
					if (this.farcasterHandle) {
						walletAnnounced(this.farcasterHandle);
					} else {
						sdk.wallet
							.getEthereumProvider()
							.then((walletProvider) => {
								this.farcasterHandle = {
									walletProvider: new EthereumWalletProvider(walletProvider as any),
									// TODO info ?
									info: {
										uuid: 'farcaster',
										name: 'Farcaster',
										icon: '',
										rdns: ''
									}
								};
								walletAnnounced(this.farcasterHandle);
							})
							.catch((err: any) => {
								console.error(`could not get wallet provider from farcaster`, err);
								super.fetchWallets(walletAnnounced);
							});
					}
				} else {
					super.fetchWallets(walletAnnounced);
				}
			})
			.catch((err) => {
				console.error(`could not get the context`, err);
				super.fetchWallets(walletAnnounced);
			});
	}
}

const chainInfo = deployments.chain;
export const connection = createConnection({
	// TODO signingOrigin
	signingOrigin: 'https://testing.etherplay.io',
	walletHost: PUBLIC_WALLET_HOST,
	chainInfo,
	prioritizeWalletProvider: false,
	// alwaysUseCurrentAccount: true,
	autoConnect: true,
	requestSignatureAutomaticallyIfPossible: true,
	walletConnector: new FarcasterWalletConnector() as EthereumWalletConnector
});

export const paymentConnection = createConnection({
	walletHost: PUBLIC_WALLET_HOST,
	chainInfo,
	prioritizeWalletProvider: true,
	alwaysUseCurrentAccount: true,
	autoConnect: false,
	requestSignatureAutomaticallyIfPossible: false
});

export const paymentWalletClient = createWalletClient({
	chain: chainInfo,
	transport: custom(paymentConnection.provider)
});

export const paymentPublicClient = createPublicClient({
	chain: chainInfo,
	transport: custom(paymentConnection.provider)
});

export const walletClient = createWalletClient({
	chain: chainInfo,
	transport: custom(connection.provider)
});

export const publicClient = createPublicClient({
	chain: chainInfo,
	transport: custom(connection.provider)
});

export type Signer = { owner: `0x${string}`; address: `0x${string}`; privateKey: `0x${string}` };
export type OptionalSigner = Signer | undefined;

export const signer = derived<typeof connection, OptionalSigner>(connection, ($connection) => {
	return $connection.step === 'SignedIn'
		? {
				owner: $connection.account.address,
				address: $connection.account.signer.address,
				privateKey: $connection.account.signer.privateKey
			}
		: undefined;
});

export type Account = `0x${string}` | undefined;

export const account = derived<typeof connection, Account>(connection, ($connection) => {
	return $connection.step === 'SignedIn'
		? $connection.account.address
		: 'account' in $connection
			? ($connection.account as any)?.address || undefined
			: undefined;
});

(globalThis as any).paymentConnection = paymentConnection;
(globalThis as any).paymentWalletClient = paymentWalletClient;
(globalThis as any).paymentPublicClient = paymentPublicClient;

(globalThis as any).connection = connection;
(globalThis as any).walletClient = walletClient;
(globalThis as any).publicClient = publicClient;
