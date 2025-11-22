import { get, writable, type Readable } from 'svelte/store';
import { account, publicClient, type Account } from '$lib/connection';
import deployments from '$lib/deployments';

export type AvatarCollection = { error?: { message: string } } & (
	| {
			step: 'Idle';
	  }
	| {
			step: 'Loading';
	  }
	| {
			step: 'Loaded';
			avatarsInWallet: readonly bigint[];
			empires: readonly bigint[];
	  }
);

function defaultState() {
	return {
		step: 'Idle'
	} as const;
}

export function createAvatarCollectionStore(
	account: Readable<Account>,
	options?: {
		fetchInterval?: number;
	}
) {
	const fetchInterval = options?.fetchInterval || 30 * 60 * 1000; // 30 minutes

	let $state: AvatarCollection = defaultState();
	let $account = get(account);

	const _store = writable<AvatarCollection>($state, start);
	function set(state: AvatarCollection) {
		$state = state;
		_store.set($state);
		return $state;
	}

	async function fetchState($account: `0x${string}`): Promise<boolean> {
		set({
			step: 'Loading'
		});

		// TODO use pagination
		let avatarsOwnedResult: readonly [readonly bigint[], boolean];
		try {
			avatarsOwnedResult = await publicClient.readContract({
				...deployments.contracts.Avatars,
				functionName: 'tokensOfOwner',
				args: [$account, 0n, 100n] // TODO use pagination
			});
		} catch (err) {
			set({
				step: 'Loading',
				error: { message: `failed to fetch owned avatars for ${$account}` }
			});
			return false;
		}

		// TPDP use Empires NFT
		// TODO use pagination
		let empiresDepositedResult: readonly [readonly bigint[], boolean];
		try {
			empiresDepositedResult = await publicClient.readContract({
				...deployments.contracts.Game,
				functionName: 'empiresPerOwner',
				args: [$account, 0n, 100n] // TODO use pagination
			});
		} catch (err) {
			set({
				step: 'Loading',
				error: { message: `failed to fetch in-game avatars for ${$account}` }
			});
			return false;
		}

		// console.log(avatarsDepositedResult);

		set({
			step: 'Loaded',
			avatarsInWallet: avatarsOwnedResult[0],
			empires: empiresDepositedResult[0]
		});
		return true;
	}

	async function fetchContinuously() {
		if ($account) {
			set({
				step: 'Loading'
			});
		} else {
			set({
				step: 'Idle'
			});
		}
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if ($account) {
			let interval = fetchInterval;
			try {
				const success = await fetchState($account);
				if (!success) {
					interval = 500;
				}
			} finally {
				if (!timeout) {
					timeout = setTimeout(fetchContinuously, interval);
				}
			}
		}
	}

	let unsubscribeFromAccount: (() => void) | undefined;
	let timeout: NodeJS.Timeout | undefined;
	function start() {
		unsubscribeFromAccount = account.subscribe(async (newAccount) => {
			const accountChanged = $account != newAccount;

			if (accountChanged) {
				$account = newAccount;
				fetchContinuously();
			}
		});

		fetchContinuously();

		return stop;
	}

	async function update() {
		await fetchContinuously();
		return $state;
	}

	function stop() {
		set(defaultState());

		if (unsubscribeFromAccount) {
			unsubscribeFromAccount();
			unsubscribeFromAccount = undefined;
		}

		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
	}

	return {
		subscribe: _store.subscribe,
		update
	};
}

export const avatars = createAvatarCollectionStore(account);

(globalThis as any).avatars = avatars;
