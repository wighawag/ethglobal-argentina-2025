<script lang="ts">
	import Warning from '$lib/ui/modal/Warning.svelte';
	import '../app.css';

	let { children } = $props();
</script>

{@render children()}

<Warning />
