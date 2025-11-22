import { get, writable, type Readable } from 'svelte/store';
import { createAutoSubmitter } from '$lib/onchain/auto-submit';
import { epochInfo, localComputer, time } from '$lib/time';
import {
	connection,
	publicClient,
	signer,
	type OptionalSigner,
	type Signer
} from '$lib/connection';
import { writes } from '$lib/onchain/writes';
import { keccak256 } from 'viem';
import deployments from '$lib/deployments';
import { privateKeyToAccount } from 'viem/accounts';
import type { Position } from 'dgame-contracts';

export type LocalAction = {
	type: 'move' | 'exit' | 'enter';
	x: number;
	y: number;
};

export type LocalAvatar = {
	actions: LocalAction[];
	submission?: {
		commit: {
			secret: `0x${string}`;
			epoch: number;
			txHash: string;
			actions: LocalAction[];
		};
		reveal?: {
			epoch: number;
			txHash: string;
		};
	};
	epoch: number;
	avatarID: string;
	exiting: boolean;
};

export type LocalSignedInState = {
	signer: Signer;
	avatar?: LocalAvatar;
	tutorialSeen: boolean;
};
export type LocalReadyState = {
	signer: Signer;
	avatar: LocalAvatar;
	tutorialSeen: boolean;
};
export type LocalState = { signer: undefined } | LocalSignedInState | LocalReadyState;

function defaultState() {
	return {
		signer: undefined
	};
}
const $state: LocalState = defaultState();

function LOCAL_STORAGE_STATE_KEY(signerAddress: `0x${string}`) {
	return `__private__${deployments.chain.id}_${deployments.chain.genesisHash}_${deployments.contracts.Game.address}_${signerAddress}`;
}

export function createLocalState(signer: Readable<OptionalSigner>) {
	const _localState = writable<LocalState>($state, start);

	function set(state: LocalState) {
		if ($state != state) {
			const keys = Object.keys(state).concat(Object.keys($state));
			for (const key of keys) {
				($state as any)[key] = (state as any)[key];
			}
		}

		if ($state.signer) {
			try {
				localStorage.setItem(LOCAL_STORAGE_STATE_KEY($state.signer.owner), JSON.stringify($state));
			} catch (err) {
				console.error(`failed to write to local storage`, err);
			}
		}
		_localState.set($state);
		return $state;
	}

	function start() {
		const unsubscribeFromOptionalSigner = signer.subscribe(($signer) => {
			if ($signer?.owner !== $state.signer?.owner) {
				if ($signer) {
					try {
						const fromStorageStr = localStorage.getItem(LOCAL_STORAGE_STATE_KEY($signer.owner));
						if (fromStorageStr) {
							const fromStorage = JSON.parse(fromStorageStr);
							set(fromStorage);
						} else {
							set({ signer: $signer, tutorialSeen: false });
						}
					} catch (err) {
						set({ signer: $signer, tutorialSeen: false });
					}
				} else {
					set({ signer: undefined });
				}
			}
		});
		return unsubscribeFromOptionalSigner;
	}

	function markTutorialAsSeen() {
		if (!$state.signer) {
			return;
		}
		$state.tutorialSeen = true;
		set($state);
	}

	function reset() {
		if (!$state.signer) {
			return;
		}
		if (!$state.avatar) {
			return;
		}
		console.log(`reseting actions`);
		$state.avatar = {
			avatarID: $state.avatar.avatarID,
			actions: [],
			epoch: $state.avatar.epoch,
			submission: undefined,
			exiting: $state.avatar.exiting
		};
	}

	function updateLocalState(epoch: number) {
		if (!$state.signer) {
			return;
		}
		if (!$state.avatar) {
			return;
		}
		if (epoch > $state.avatar.epoch) {
			console.log(`new epoch, we reset actions`);
			$state.avatar = {
				avatarID: $state.avatar.avatarID,
				actions: [],
				epoch,
				submission: undefined,
				exiting: $state.avatar.exiting
			};
		}
	}

	let commiting = false;
	let revealing = false;
	return {
		get value() {
			return $state;
		},
		subscribe: _localState.subscribe,
		markTutorialAsSeen,
		addAction(epoch: number, action: LocalAction) {
			updateLocalState(epoch);

			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.avatar) {
				throw new Error(`no avatar`);
			}

			if ($state.avatar.submission) {
				throw new Error(`submission in progress`);
			}

			if ($state.avatar.actions[0]?.type === 'enter') {
				return;
			}

			$state.avatar.actions.push(action);
			set($state);
		},
		update(epoch: number) {
			updateLocalState(epoch);
			set($state);
		},
		reset,
		enter(avatarID: bigint, epoch: number, position: Position) {
			updateLocalState(epoch);
			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			// TODO should we still check here to avoid overriding by mistake ?
			// if ($state.avatar && $state.avatar.avatarID != avatarID.toString()) {
			// 	throw new Error(`got an avatar already`);
			// }

			console.log(`enterring at epoch: ${epoch}`);
			const actions: LocalAction[] = [{ type: 'enter', x: position.x, y: position.y }];

			// console.log(`avatars`, avatarID);

			$state.avatar = {
				avatarID: avatarID.toString(),
				actions,
				epoch,
				exiting: false
			};

			set($state);
		},

		async commit(options?: { pollingInterval?: number }) {
			if (commiting) {
				console.log(`already commiting...`);
				return;
			}

			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.avatar) {
				throw new Error(`no avatar`);
			}

			const $epochInfo = epochInfo.now();
			const { currentEpoch: epoch } = $epochInfo;

			if ($state.avatar.epoch > epoch) {
				console.log(`not in yet`);
				return;
			}

			updateLocalState(epoch);

			console.log(`commiting for epoch ${epoch}...`);

			try {
				commiting = true;

				const actions = [...$state.avatar.actions];

				const account = privateKeyToAccount($state.signer.privateKey);
				const secretSig = await account.signMessage({
					message: `Commit:${deployments.chain.id}:${deployments.contracts.Game.address}:${epoch}`
				});
				const secret = keccak256(secretSig);
				const { transactionID, wait } = await writes.commit_actions(
					BigInt($state.avatar.avatarID),
					secret,
					actions,
					options
				);

				$state.avatar.submission = {
					commit: {
						epoch,
						secret,
						txHash: transactionID,
						actions
					}
				};
				$state.avatar.exiting = !!actions.find((action) => action.type === 'exit');
				set($state);

				console.log(`waiting for commit tx...`);

				const receipt = await wait();
				console.log(`... commit receipt received!`);
				if (receipt.status === 'reverted') {
					console.error(`commit reverted`, receipt);
					$state.avatar.submission = undefined;
					set($state);
				}
			} catch (err) {
				$state.avatar.submission = undefined;
				set($state);
				console.error(err);
			} finally {
				commiting = false;
			}
		},

		rewind(epoch: number) {
			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.avatar) {
				throw new Error(`no avatar`);
			}

			updateLocalState(epoch);

			if ($state.avatar.actions.length > 0) {
				if ($state.avatar.actions[$state.avatar.actions.length - 1].type !== 'enter') {
					const lastAction = $state.avatar.actions.pop();
					// if (lastAction?.type === 'exit') {
					// TODO auto cancel the move too ?
					// need to handle case where there i s no move
					// }
				}
			}
			set($state);
		},

		removeAvatar() {
			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.avatar) {
				throw new Error(`no avatar`);
			}
			$state.avatar = undefined;
			set($state);
		},

		async reveal(options?: { pollingInterval?: number }) {
			if (revealing) {
				console.log(`already revealing...`);
				return;
			}

			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.avatar) {
				throw new Error(`no avatar`);
			}

			const $epochInfo = epochInfo.now();
			const { currentEpoch: epoch } = $epochInfo;

			updateLocalState(epoch);

			if (!$state.avatar.submission) {
				return;
			}

			console.log(`revealing for epoch ${epoch}...`);

			const commitment = $state.avatar.submission.commit;
			if (!commitment) {
				throw new Error(`cannot reveal without commitment info`);
			}

			try {
				revealing = true;

				// const block = await time.fetchBlockTime();
				// const epochAccordingToBlockTime = localComputer.calculateEpochInfo(block.blockTime);

				// if (epochAccordingToBlockTime.isCommitPhase) {
				// 	throw new Error(`time is not valid`);
				// }

				const { transactionID, wait } = await writes.reveal_actions(
					BigInt($state.avatar.avatarID),
					commitment.secret,
					commitment.actions,
					options
				);

				$state.avatar.submission = {
					commit: commitment,
					reveal: {
						epoch,
						txHash: transactionID
					}
				};
				set($state);

				console.log(`waiting for reveal tx...`);

				const receipt = await wait();
				console.log(`... reveal receipt received!`);
				if (receipt.status === 'reverted') {
					console.error(`reveal reverted`, receipt);
					$state.avatar.submission.reveal = undefined;
					set($state);
				}
			} catch (err) {
				if ($state.avatar.submission) {
					$state.avatar.submission.reveal = undefined;
					set($state);
				}
				console.error(err);
			} finally {
				revealing = false;
			}
		}
	};
}

export const localState = createLocalState(signer);

export const autoSubmitter = createAutoSubmitter();
autoSubmitter.start();

(globalThis as any).autoSubmitter = autoSubmitter;
(globalThis as any).localState = localState;
