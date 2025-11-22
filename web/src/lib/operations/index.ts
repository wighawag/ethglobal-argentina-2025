import { eventEmitter } from '$lib/render/eventEmitter';
import { localState, type LocalReadyState, type LocalState } from '$lib/private/localState';
import { get } from 'svelte/store';
import { avatars } from '$lib/onchain/avatars';
import { enterFlow } from '$lib/ui/flows/enter/enterFlow';
import { epochInfo, timeConfig, type EpochInfo } from '$lib/time';
import { viewState, type Position, type ViewState } from '$lib/view';
import { areaAt, Areas, zoneLocalCoord } from 'dgame-contracts';
import deployments from '$lib/deployments';
import { camera } from '$lib/render/camera';
import { warning } from '$lib/ui/modal/warning';

type ReadyState = {
	step: 'Ready';
	currentPosition: Position;
	currentCellType: number;
	exited: boolean;
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
	const avatarEntity =
		$localState.signer && $localState.avatar?.avatarID
			? $viewState.entities[$localState.avatar.avatarID]
			: undefined;

	if ($localState.signer && $localState.avatar && avatarEntity) {
		let currentPosition: Position;

		let exited = false;
		if ($localState.avatar.epoch === epoch && $localState.avatar.actions.length > 0) {
			const lastAction = $localState.avatar.actions[$localState.avatar.actions.length - 1];

			currentPosition = lastAction;
			exited = lastAction.type === 'exit';
		} else {
			currentPosition = avatarEntity.position;
		}
		const areaLocalX = zoneLocalCoord(currentPosition.x);
		const areaLocalY = zoneLocalCoord(currentPosition.y);
		const area = areaAt(currentPosition.x, currentPosition.y);
		const cellIndex = areaLocalX + areaLocalY * area.size;
		const currentCellType = area.cells[cellIndex];

		return {
			step: 'Ready',
			currentPosition,
			currentCellType,
			exited,
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

function addMove(dx: number, dy: number) {
	const currentState = gatherState();
	if (currentState.timeup) {
		return;
	}

	if (currentState.step === 'Ready' && !currentState.exited) {
		const toX = currentState.currentPosition.x + dx;
		const toY = currentState.currentPosition.y + dy;

		const areaLocalX = zoneLocalCoord(toX);
		const areaLocalY = zoneLocalCoord(toY);
		const area = areaAt(toX, toY);
		const cellIndex = areaLocalX + areaLocalY * area.size;

		const numMovesSoFar = currentState.$localState.avatar.actions.filter(
			(v) => v.type === 'move'
		).length;
		if (numMovesSoFar >= Number(deployments.contracts.Game.linkedData.numMoves)) {
			return;
		}

		if (area.cells[cellIndex] == 0 || area.cells[cellIndex] == 3) {
			localState.addAction(currentState.epoch, {
				type: 'move',
				x: toX,
				y: toY
			});
			camera.follow(toX, toY);
		}
	}
}

function addExit(currentState: ReadyState) {
	if (currentState.timeup) {
		return;
	}

	if (!currentState.exited) {
		if (currentState.currentCellType == 3) {
			localState.addAction(currentState.epoch, {
				type: 'exit',
				x: currentState.currentPosition.x,
				y: currentState.currentPosition.y
			});
		}
	}
}

export function startListening() {
	eventEmitter.on('down', () => {
		addMove(0, 1);
	});

	eventEmitter.on('up', () => {
		addMove(0, -1);
	});

	eventEmitter.on('left', () => {
		addMove(-1, 0);
	});

	eventEmitter.on('right', () => {
		addMove(1, 0);
	});

	eventEmitter.on('action', () => {
		const currentState = gatherState();
		if (currentState.timeup) {
			return;
		}
		if (currentState.step === 'Ready') {
			if (currentState.currentCellType === 3) {
				// console.log(`adding exit`);
				addExit(currentState);
			} else {
				console.log(`no action to do`);
			}
		}
	});

	eventEmitter.on('action-2', () => {
		const currentState = gatherState();
		if (currentState.timeup) {
			return;
		}
		if (currentState.step === 'Ready') {
			if (currentState.currentCellType === 3) {
			} else {
				console.log(`no action to do`);
			}
		}
	});

	eventEmitter.on('clicked', (pos) => {
		const areaLocalX = zoneLocalCoord(pos.x);
		const areaLocalY = zoneLocalCoord(pos.y);
		const area = areaAt(pos.x, pos.y);
		const cellIndex = areaLocalX + areaLocalY * area.size;
		const currentCellType = area.cells[cellIndex];

		if (currentCellType == 0) {
			const $avatars = get(avatars);

			if ($avatars.step == 'Loaded') {
				// && $avatars.avatarsInGame.length == 0) {
				enterFlow.start(pos);
			}
		}
	});

	eventEmitter.on('backspace', () => {
		const currentState = gatherState();
		if (currentState.timeup) {
			return;
		}
		localState.rewind(currentState.$epochInfo.currentEpoch);
	});
}

export function stopListening() {
	eventEmitter.removeAllListeners();
}
