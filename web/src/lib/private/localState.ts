import { signer, type OptionalSigner, type Signer } from '$lib/connection';
import deployments from '$lib/deployments';
import { createAutoSubmitter } from '$lib/onchain/auto-submit';
import { writes } from '$lib/onchain/writes';
import { epochInfo } from '$lib/time';
import type { Position } from 'dgame-contracts';
import { writable, type Readable } from 'svelte/store';
import { keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type LocalAction =
	| {
			type: 'acquire';
			location: {
				x: number;
				y: number;
			};
	  }
	| {
			type: 'sendFleet';
			from: { x: number; y: number };
			to: { x: number; y: number };
			fleet: {
				spaceships: number;
			};
			minArrivalEpoch: number;
	  };

export type EmpireData = {
	empireID: string;
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
};

export type LocalSignedInState = {
	signer: Signer;
	empire?: EmpireData;
	tutorialSeen: boolean;
};
export type LocalReadyState = {
	signer: Signer;
	empire: EmpireData;
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
		if (!$state.empire) {
			return;
		}
		console.log(`reseting actions`);
		$state.empire = {
			empireID: $state.empire.empireID,
			actions: [],
			epoch: $state.empire.epoch,
			submission: undefined
		};
	}

	function updateLocalState(epoch: number) {
		if (!$state.signer) {
			return;
		}
		if (!$state.empire) {
			return;
		}
		if (epoch > $state.empire.epoch) {
			console.log(`new epoch, we reset actions`);
			$state.empire = {
				empireID: $state.empire.empireID,
				actions: [],
				epoch,
				submission: undefined
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

			if (!$state.empire) {
				throw new Error(`no empire`);
			}

			if ($state.empire.submission) {
				throw new Error(`submission in progress`);
			}

			$state.empire.actions.push(action);
			set($state);
		},
		update(epoch: number) {
			updateLocalState(epoch);
			set($state);
		},
		reset,
		// enter(empireID: bigint, epoch: number, position: Position) {
		// 	updateLocalState(epoch);
		// 	if (!$state.signer) {
		// 		throw new Error(`no signer`);
		// 	}

		// 	// TODO should we still check here to avoid overriding by mistake ?
		// 	// if ($state.empire && $state.empire.empireID != empireID.toString()) {
		// 	// 	throw new Error(`got an empire already`);
		// 	// }

		// 	console.log(`enterring at epoch: ${epoch}`);
		// 	const actions: LocalAction[] = [{ type: 'enter', x: position.x, y: position.y }];

		// 	// console.log(`empires`, empireID);

		// 	$state.empire = {
		// 		empireID: empireID.toString(),
		// 		actions,
		// 		epoch,
		// 		exiting: false
		// 	};

		// 	set($state);
		// },

		async commit(options?: { pollingInterval?: number }) {
			if (commiting) {
				console.log(`already commiting...`);
				return;
			}

			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.empire) {
				throw new Error(`no empire`);
			}

			const $epochInfo = epochInfo.now();
			const { currentEpoch: epoch } = $epochInfo;

			if ($state.empire.epoch > epoch) {
				console.log(`not in yet`);
				return;
			}

			updateLocalState(epoch);

			console.log(`commiting for epoch ${epoch}...`);

			try {
				commiting = true;

				const actions = [...$state.empire.actions];

				const account = privateKeyToAccount($state.signer.privateKey);
				const secretSig = await account.signMessage({
					message: `Commit:${deployments.chain.id}:${deployments.contracts.Game.address}:${epoch}`
				});
				const secret = keccak256(secretSig);
				const { transactionID, wait } = await writes.commit_actions(
					BigInt($state.empire.empireID),
					secret,
					actions,
					options
				);

				$state.empire.submission = {
					commit: {
						epoch,
						secret,
						txHash: transactionID,
						actions
					}
				};
				set($state);

				console.log(`waiting for commit tx...`);

				const receipt = await wait();
				console.log(`... commit receipt received!`);
				if (receipt.status === 'reverted') {
					console.error(`commit reverted`, receipt);
					$state.empire.submission = undefined;
					set($state);
				}
			} catch (err) {
				$state.empire.submission = undefined;
				set($state);
				console.error(err);
			} finally {
				commiting = false;
			}
		},

		removeEmpire() {
			if (!$state.signer) {
				throw new Error(`no signer`);
			}

			if (!$state.empire) {
				throw new Error(`no empire`);
			}
			$state.empire = undefined;
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

			if (!$state.empire) {
				throw new Error(`no empire`);
			}

			const $epochInfo = epochInfo.now();
			const { currentEpoch: epoch } = $epochInfo;

			updateLocalState(epoch);

			if (!$state.empire.submission) {
				return;
			}

			console.log(`revealing for epoch ${epoch}...`);

			const commitment = $state.empire.submission.commit;
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
					BigInt($state.empire.empireID),
					commitment.secret,
					commitment.actions,
					options
				);

				$state.empire.submission = {
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
					$state.empire.submission.reveal = undefined;
					set($state);
				}
			} catch (err) {
				if ($state.empire.submission) {
					$state.empire.submission.reveal = undefined;
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
