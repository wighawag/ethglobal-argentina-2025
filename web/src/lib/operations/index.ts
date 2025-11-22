import { eventEmitter } from '$lib/render/eventEmitter';
import { type LocalReadyState, type LocalState } from '$lib/private/localState';
import { type EpochInfo } from '$lib/time';
import { type Position, type ViewState } from '$lib/view';

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

export function startListening() {
	eventEmitter.on('clicked', (pos) => {
		// TODO
		console.log(`clicked`, pos);
	});
}

export function stopListening() {
	eventEmitter.removeAllListeners();
}
