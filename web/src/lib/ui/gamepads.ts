import type { EventEnitter } from '$lib/render/eventEmitter';

interface GamepadController {
	start: () => void;
	stop: () => void;
}

export function createGamepadController(eventEmitter: EventEnitter): GamepadController {
	let running = false;

	function gamepadconnected(e: Event) {}

	function gamepaddisconnected(e: Event) {}

	let state = {
		up: false,
		down: false,
		right: false,
		left: false,
		action1: false,
		action2: false,
		backspace: false
	};

	function updateStatus() {
		if (!running) {
			return;
		}

		const gamepads = navigator.getGamepads();
		for (const gamepad of gamepads) {
			if (!gamepad) {
				continue;
			}

			if (gamepad.buttons[3].pressed) {
				console.log(gamepad);
			}

			const isAction1 = gamepad.buttons[0].pressed;
			if (!state.action1 && isAction1) {
				eventEmitter.emit('action');
			}

			const isAction2 = gamepad.buttons[1].pressed;
			if (!state.action2 && isAction2) {
				eventEmitter.emit('action-2');
			}

			const isBackspace = gamepad.buttons[3].pressed;
			if (!state.backspace && isBackspace) {
				eventEmitter.emit('backspace');
			}

			const isLeft = gamepad.axes[0] < -0.1 || gamepad.buttons[14].pressed;
			if (!state.left && isLeft) {
				eventEmitter.emit('left');
			}
			const isRight = gamepad.axes[0] > 0.1 || gamepad.buttons[15].pressed;
			if (!state.right && isRight) {
				eventEmitter.emit('right');
			}
			const isUp = gamepad.axes[1] < -0.1 || gamepad.buttons[12].pressed;
			if (!state.up && isUp) {
				eventEmitter.emit('up');
			}
			const isDown = gamepad.axes[1] > 0.1 || gamepad.buttons[13].pressed;
			if (!state.down && isDown) {
				eventEmitter.emit('down');
			}

			state.left = isLeft;
			state.right = isRight;
			state.up = isUp;
			state.down = isDown;
			state.action1 = isAction1;
			state.action2 = isAction2;
			state.backspace = isBackspace;
		}

		requestAnimationFrame(updateStatus);
	}

	// The controller object to be returned
	const controller = {
		start: function () {
			window.addEventListener('gamepadconnected', gamepadconnected);
			window.addEventListener('gamepaddisconnected', gamepaddisconnected);

			if (!running) {
				running = true;
				requestAnimationFrame(updateStatus);
			}
		},

		stop: function () {
			running = false;
			window.removeEventListener('gamepadconnected', gamepadconnected);
			window.removeEventListener('gamepaddisconnected', gamepaddisconnected);
		}
	};

	return controller;
}
