import type { Readable } from 'svelte/store';

export type BaseEntity = { id: bigint; position: { x: number; y: number } };

export type StarSystemEntity = BaseEntity & {
	owner: string;
	type: 'starSystem';
};

export type Entity = StarSystemEntity;
export type OnchainState = {
	entities: Map<bigint, Entity>;
	epoch: number;
};

export type OnChainLayer = Readable<OnchainState>;

// Each game define their OnchainState interface
// the OnchainLayer listen from a view parameter s(camera, etc...)

// what state can be retrived and modified locally : we try to anticipate the pending layer

// Actions generate PendingActions
// it is a object that has a list of function, upon executing them a actionId along with a way to retrived its completion is returned and emitted.
// it is chain specific and game specific, but we can probably extract the chain specicif part

// Each game define their Actions interface

// PendingActionStore listen for PendingActions and emit changes to them
// this store listen to PendingActions and check for their completion, etc..
// it emits the changes

// PendingOnchainLayyer depends on OnChainLayer + PendingActionStore
// it merge the OnchainLayer with the PendingActions

// is game specific but not chain specific

// ViewLayer is what the game use to render
// it listen to PendingOnchainLayer
