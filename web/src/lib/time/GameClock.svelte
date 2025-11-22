<script lang="ts">
	import { localState } from '$lib/private/localState';
	import Modal from '$lib/ui/modal/Modal.svelte';
	import { fade } from 'svelte/transition';
	import { epochInfo, time, threePhase, twoPhase } from './index';
	import ms from 'pretty-ms';
	import deployments from '$lib/deployments';

	let percentage = $derived(
		Math.min(100, Math.max(0, 100 - Math.floor(($twoPhase.timeLeft * 100) / $twoPhase.duration)))
	);

	let color = $derived(
		$twoPhase.phase == 'play' ? 'oklch(57.7% 0.245 27.325)' : 'oklch(85.2% 0.199 91.936)'
	);
	let background = $derived($twoPhase.phase == 'play' ? 'oklch(79.2% 0.209 151.711)' : 'red');

	// SVG pie chart parameters
	const size = 100;
	const center = size / 2;
	const radius = 40;

	// Calculate the path for the pie slice - starts at top like a clock
	function calculatePiePath(percent: number): string {
		const angle = (percent / 100) * 360;
		const startAngle = 0; // Start at top (12 o'clock)
		const endAngle = startAngle + angle;

		const startX = center + radius * Math.cos(((startAngle - 90) * Math.PI) / 180);
		const startY = center + radius * Math.sin(((startAngle - 90) * Math.PI) / 180);
		const endX = center + radius * Math.cos(((endAngle - 90) * Math.PI) / 180);
		const endY = center + radius * Math.sin(((endAngle - 90) * Math.PI) / 180);

		const largeArcFlag = angle > 180 ? 1 : 0;

		if (angle === 0) return '';
		if (angle >= 360) {
			return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY} Z`;
		}

		return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
	}

	const piePath = $derived(calculatePiePath(percentage));
</script>

<div id="game-clock" class="progress-container" style={`--color: ${color}; --background: ${background}`}>
	<svg width={size} height={size} class="progress-svg" viewBox={`0 0 ${size} ${size}`}>
		<!-- Background circle (full pie) -->
		<circle
			cx={center}
			cy={center}
			r={radius}
			fill="var(--background)"
			class="progress-background"
		/>
		<!-- Progress pie slice -->
		{#if piePath}
			<path d={piePath} fill="var(--color)" class="progress-bar" />
		{/if}
	</svg>
</div>

{#if $twoPhase.phase === 'wait' && $twoPhase.timeLeft > 0.1 && !!$localState.signer && !!$localState.avatar}
	<div
		class="fixed bottom-0 left-0 z-50 flex h-12 w-full items-center justify-between bg-red-600 px-4 text-white shadow-md"
	>
		<span>Please wait for Action Resolution...</span>
		<div>{ms($twoPhase.timeLeft * 1000)} left</div>
	</div>
{/if}

{#if ($twoPhase.phase === 'wait' && $twoPhase.timeLeft > 0.1 && !!$localState.signer && !!$localState.avatar) || ($localState.signer ? !!$localState.avatar?.actions.find((v) => v.type === 'enter') && $localState.avatar.epoch >= $epochInfo.currentEpoch : false)}
	<div
		transition:fade
		class="full-screen-border border-red-600"
		style="
      border-width: 10px; 
      border-radius: 0px;
    "
	></div>
{:else if $localState.signer && $localState.avatar && Number(deployments.contracts.Game.linkedData.numMoves) - $localState.avatar.actions.filter((v) => v.type === 'move').length <= 0}
	<div
		transition:fade
		class="full-screen-border border-yellow-600"
		style="
      border-width: 10px; 
      border-radius: 0px;
    "
	></div>
{/if}

<style>
	.progress-container {
		width: 100px;
		height: 100px;
		position: relative;
		display: inline-block;
	}

	.progress-bar {
		filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.3));
	}

	.full-screen-border {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 999999;
		box-sizing: border-box;
		border-style: solid;
	}
</style>
