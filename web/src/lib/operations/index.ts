import { eventEmitter } from '$lib/render/eventEmitter';
import { localState, type LocalReadyState, type LocalState } from '$lib/private/localState';
import { epochInfo, timeConfig, type EpochInfo } from '$lib/time';
import { viewState, type Position, type ViewState } from '$lib/view';
import { get } from 'svelte/store';

type ReadyState = {
	step: 'Ready';
	epoch: number;
	$viewState: ViewState;
	$localState: LocalReadyState;
	$epochInfo: EpochInfo;
	timeup: boolean;
};
type CurrentState =
	| {
			step: 'Idle';
			$viewState: ViewState;
			$localState: LocalState;
			$epochInfo: EpochInfo;
			timeup: boolean;
	  }
	| ReadyState;

function gatherState(): CurrentState {
	const $epochInfo = epochInfo.now();
	const { currentEpoch: epoch } = $epochInfo;

	const timeup =
		!$epochInfo.isCommitPhase ||
		$epochInfo.timeLeftInPhase < timeConfig.COMMIT_TIME_ALLOWANCE - 0.2;

	localState.update(epoch);
	const $localState = get(localState);
	const $viewState = get(viewState);

	if ($localState.signer && $localState.empire) {
		if ($localState.empire.epoch === epoch && $localState.empire.actions.length > 0) {
			// TODO ?
		}

		return {
			step: 'Ready',
			epoch,
			$viewState,
			$localState: $localState as LocalReadyState,
			$epochInfo,
			timeup
		};
	} else {
		return {
			step: 'Idle',
			$viewState,
			$localState,
			$epochInfo,
			timeup
		};
	}
}
function acquire(x: number, y: number) {
	const currentState = gatherState();
	if (currentState.timeup) {
		return;
	}

	if (currentState.step === 'Ready') {
		localState.addAction(currentState.epoch, {
			type: 'acquire',
			location: {
				x,
				y
			}
		});
	}
}

export function startListening() {
	eventEmitter.on('clicked', (pos) => {
		// TODO
		console.log(`clicked`, pos);
		acquire(pos.x, pos.y);
	});
}

export function stopListening() {
	eventEmitter.removeAllListeners();
}
