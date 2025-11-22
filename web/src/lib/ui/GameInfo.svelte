<script lang="ts">
	import { localState } from '$lib/private/localState';
	import Modal from '$lib/ui/modal/Modal.svelte';
	import { epochInfo, time, threePhase, twoPhase } from '$lib/time/index.js';
	import { viewState, type AvatarViewEntity } from '$lib/view';
	import { avatars } from '$lib/onchain/avatars';

	function clear() {
		avatars.update();
		localState.removeAvatar();
	}

	let avatar = $derived(
		$viewState.avatarID ? ($viewState.entities[$viewState.avatarID] as AvatarViewEntity) : undefined
	);
</script>

<Modal
	openWhen={avatar ? avatar.life == 0 && $epochInfo.currentEpoch >= avatar.lastEpoch + 1 : false}
>
	{#snippet title()}
		Your avatar died
	{/snippet}
	<div>
		<button onclick={() => clear()}>ok</button>
	</div>
</Modal>
