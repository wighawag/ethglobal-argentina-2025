<script lang="ts">
	import { avatars } from '$lib/onchain/avatars';
	import { localState } from '$lib/private/localState';

	function clear() {
		avatars.update();
		localState.removeAvatar();
	}

</script>
