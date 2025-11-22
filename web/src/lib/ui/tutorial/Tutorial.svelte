<script lang="ts">
	import { localState } from '$lib/private/localState';
	import { startTour } from '$lib/ui/tutorial/tour';
	import Button from '../generic/Button.svelte';
</script>

{#if $localState.signer && !$localState.tutorialSeen}
	<div class="absolute left-0 top-0 z-50 h-screen w-screen flex items-center justify-center">
		<div class="max-w-[calc(100vw-128px)] max-h-[calc(100vh-128px)] p-16 bg-gray-900">
		
		<h1 class="text-lg font-bold">Welcome to Reveal Or Die</h1>
		
		<p>Ready?</p>

		<p></p>

		<div>
			<Button onclick={() => startTour(() => localState.markTutorialAsSeen())}>Start Tour</Button>
			<Button onclick={() => localState.markTutorialAsSeen()}>Skip</Button>
		</div>
		
		</div>
	</div>
{/if}


<style>
	p {
		margin-top: 1rem;
	}
</style>