import { EventEmitter } from 'tseep';

export const eventEmitter = new EventEmitter<{
	clicked: (pos: { x: number; y: number }) => void;
}>();

export type EventEnitter = typeof eventEmitter;
