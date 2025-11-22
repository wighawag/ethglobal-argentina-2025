import { PUBLIC_FAUCET_PRIVATE_KEY } from '$env/static/public';
import { avatars } from '$lib/onchain/avatars';
import { writes } from '$lib/onchain/writes';
import { extractedPromise } from '$lib/utils/promise';
import { writable } from 'svelte/store';

export type PurchaseFlow = { error?: { message: string } } & (
	| {
			step: 'Idle';
	  }
	| {
			step: 'RequireSignIn';
	  }
	| {
			step: 'Ready';
	  }
	| {
			step: 'ConfirmTransaction';
	  }
	| {
			step: 'PendingTransaction';
			pendingTransaction: `0x${string}`;
	  }
);

function createPurchaseFlow() {
	let $data: PurchaseFlow = { step: 'Idle' };
	const store = writable<PurchaseFlow>($data);

	function set(data: PurchaseFlow) {
		$data = data;
		store.set($data);
	}

	let pendingFlow:
		| { promise: Promise<void>; resolve: () => void; reject: (err: unknown) => void }
		| undefined;
	function resolve() {
		if (pendingFlow) {
			pendingFlow.resolve();
			pendingFlow = undefined;
		}
	}
	function reject(err: unknown) {
		if (pendingFlow) {
			pendingFlow.reject(err);
			pendingFlow = undefined;
		}
	}

	function start(): Promise<void> {
		if (pendingFlow) {
			pendingFlow.reject({ message: 'overriden' });
		}
		pendingFlow = extractedPromise<void>();
		// TODO connection check
		set({ step: 'Ready' });
		return pendingFlow.promise;
	}

	async function purchase() {
		try {
			console.log(`purchasing...`);
			set({ step: 'ConfirmTransaction' });
			let wait: () => Promise<unknown>;
			let avatarID: bigint;
			let transactionID: `0x${string}`;
			if (PUBLIC_FAUCET_PRIVATE_KEY) {
				console.log(`using faucet for purchase...`);
				const transaction = await writes.purchaseViaFaucet();
				wait = transaction.wait;
				avatarID = transaction.avatarID;
				transactionID = transaction.transactionID;
			} else {
				console.log(`using wallet for purchase...`);
				const transaction = await writes.purchaseViaPaymentConnection();
				wait = transaction.wait;
				avatarID = transaction.avatarID;
				transactionID = transaction.transactionID;
			}
			set({ step: 'PendingTransaction', pendingTransaction: transactionID });
			await wait();
			let $avatars = await avatars.update();
			const hasAvatar = () =>
				$avatars.step === 'Loaded' && $avatars.empires.find((v) => v == avatarID);
			while (!hasAvatar()) {
				$avatars = await avatars.update();
			}
			set({ step: 'Idle' });
			resolve();
		} catch (err) {
			// TODO attempt to recover
			console.error(err);
			set({ step: 'Idle' });
			reject(err);
			return;
		}
	}

	function cancel() {
		set({ step: 'Idle' });
		reject({ message: 'cancelled' });
	}

	return {
		subscribe: store.subscribe,
		cancel,
		start,
		purchase
	};
}

export const purchaseFlow = createPurchaseFlow();
