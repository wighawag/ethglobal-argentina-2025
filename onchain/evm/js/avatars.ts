import type {Abi, ExtractAbiEvent, ExtractAbiEventNames} from 'abitype';

export type Avatar = {
	avatarID: bigint;
	position: bigint;
};

export type AvatarAction = {actionType: number; data: bigint};

export type AvatarWithLastActions = Avatar & {
	lastActions?: readonly AvatarAction[];
};

export type Avatars = Map<bigint, AvatarWithLastActions>;

function getEventFromAbi<
	abi extends Abi,
	eventName extends ExtractAbiEventNames<abi>,
>(abi: abi, eventName: eventName): ExtractAbiEvent<abi, eventName> {
	for (const item of abi) {
		if (item.type === 'event' && item.name === eventName) {
			return item as ExtractAbiEvent<abi, eventName>;
		}
	}
	throw new Error('Event not found');
}
