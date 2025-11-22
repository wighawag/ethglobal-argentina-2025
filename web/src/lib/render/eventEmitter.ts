import { EventEmitter } from 'tseep';

export const eventEmitter = new EventEmitter<{
	clicked: (pos: { x: number; y: number }) => void;
	up: () => void;
	down: () => void;
	left: () => void;
	right: () => void;
	action: () => void;
	'action-2': () => void;
	backspace: () => void;
}>();

export type EventEnitter = typeof eventEmitter;
