import { sdk } from '@farcaster/miniapp-sdk';

export async function signalReady() {
	console.log(`signaling...`);
	// After your app is fully loaded and ready to display
	await sdk.actions.ready();
	console.log(`...ready`);
}
