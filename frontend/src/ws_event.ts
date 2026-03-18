export type ImagePostedEvent = {
	type: "ImagePosted";
	id: string;
	object_key: string;
	title: string | null;
	display_name: string;
	user_identifier: string;
};

export type ImageDeletedEvent = {
	type: "ImageDeleted";
	id: string;
};

export type CommentPostedEvent = {
	type: "CommentPosted";
	id: string;
	display_name: string;
	content: string;
	user_identifier: string;
};

export type CommentDeletedEvent = {
	type: "CommentDeleted";
	id: string;
};

export type VotedUpdatedEvent = {
	type: "VotedUpdated";
	image_id: string;
	is_good: boolean;
	is_new: boolean;
	changed: boolean;
};

export type UserBannedEvent = {
	type: "UserBanned";
	his_identifier: string;
};

export type ResolveUerBanEvent = {
	type: "ResolveUerBan";
	his_identifier: string;
};

export type RoomDeletedEvent = {
	type: "RoomDeleted";
};

export type OthersJoinEvent = {
	type: "OthersJoin";
};

export type OthersDropEvent = {
	type: "OthersDrop";
};

export type WsEvent =
	| ImagePostedEvent
	| ImageDeletedEvent
	| CommentPostedEvent
	| CommentDeletedEvent
	| VotedUpdatedEvent
	| UserBannedEvent
	| ResolveUerBanEvent
	| RoomDeletedEvent
	| OthersJoinEvent
	| OthersDropEvent;
