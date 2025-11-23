<script lang="ts">
	import ConnectionFlow from '$lib/connection/ConnectionFlow.svelte';
	import TopBar from '$lib/ui/structure/TopBar.svelte';
	import PixiCanvas from '$lib/render/PixiCanvas.svelte';
	import { camera } from '$lib/render/camera.js';
	import { renderer } from '$lib/render/renderer.js';
	import { eventEmitter } from '$lib/render/eventEmitter.js';
	import PurchaseFlow from '$lib/ui/flows/purchase/PurchaseFlow.svelte';
	import GameClock from '$lib/time/GameClock.svelte';
	import { paymentConnection, connection } from '$lib/connection';
	import WalletOnlyConnectionFlow from '$lib/connection/WalletOnlyConnectionFlow.svelte';
	import GameInfo from '$lib/ui/GameInfo.svelte';
	import Tutorial from '$lib/ui/tutorial/Tutorial.svelte';
	import { isMiniApp } from '$lib/utils/mini-app';
</script>

<main>
	<div class="pointer-events-auto">
		<TopBar />
	</div>
	<div class="ml-2 mt-16"><GameClock /></div>
</main>

<PurchaseFlow />

{#if isMiniApp}
<WalletOnlyConnectionFlow connection={connection} />
{:else}
<ConnectionFlow {connection} />
{/if}
<WalletOnlyConnectionFlow connection={paymentConnection} />

<div class="canvas">
	<PixiCanvas {camera} {renderer} {eventEmitter} />
</div>

<GameInfo />

<Tutorial />

<style>
	main {
		position: absolute;
		z-index: 1;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.canvas {
		pointer-events: none;
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
	}

</style>
