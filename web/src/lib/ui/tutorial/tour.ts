import 'driver.js/dist/driver.css';
import { driver } from 'driver.js';
import { writable } from 'svelte/store';
import deployments from '$lib/deployments';

const _tour = writable({ running: false });
export const tour = {
	subscribe: _tour.subscribe
};

export function startTour(callback?: () => void) {
	let interval: NodeJS.Timeout | undefined;
	const driverObj = driver({
		popoverClass: 'driverjs-theme',
		showProgress: true,
		animate: false,
		allowClose: false,
		// disableActiveInteraction: true,
		steps: [
			{
				element: '#game-clock',
				popover: {
					title: 'Your timer',
					description:
						'"Reveal Or Die" is a template for simultaneous turn based game with 2 phases, commit and reveal. The clock shows you the countdown of each phase. Once green you can play, once red you have to wait for the resolution to finish'
				}
			},
			{
				element: '#stats',
				popover: {
					title: 'Moves left',
					description: `You are given ${deployments.contracts.Game.linkedData.numMoves} moves`
				}
			},
			{
				element: '#navigation',
				popover: {
					title: 'Controls',
					description: `You can control your character using either these button or the keyboard using arrow keys or WASD for movement, and BACKSPACE to undo your last move.`
				}
			},
			{
				element: '#game-clock',
				popover: {
					title: 'Moves are submitted automatically',
					description:
						'Remember that once the clock is red, your moves will be submitted, so be careful!'
				}
			},
			{
				element: '#arena',
				popover: {
					title: 'The Arena',
					description: 'To enter the game, you just need to pick a location in the arean'
				}
			},
			{
				element: '#avatars',
				popover: {
					title: 'Get Your Avatar',
					description: `And to get started you will need a an avatar. For this demo, you can get it for free`
				}
			}
		],
		onDestroyed(elem) {
			if (interval) {
				clearInterval(interval);
			}
			_tour.set({ running: false });
			callback && callback();
		}
	});
	interval = setInterval(() => {
		if (driverObj) {
			// needed if elements moves
			driverObj.refresh();
		}
	}, 200);
	_tour.set({ running: true });
	driverObj.drive();
}
