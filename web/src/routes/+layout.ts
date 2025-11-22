import { get } from 'svelte/store';

export const prerender = true;
export const trailingSlash = 'always';
export const ssr = false;

(globalThis as any).get = get;
