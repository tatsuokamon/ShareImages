import type { CommentMeta } from "../comment";
import type { ImgMeta } from "../image";

export type ImagePosted = ImgMeta & {
	type: "ImagePosted";
};

export type ImageDeleted = {
	type: "ImageDeleted";
	id: string;
};

export type CommentPosted = CommentMeta & {
	type: "CommentPosted";
};

export type CommentDeleted = {
	type: "CommentDeleted";
	id: string;
};

export type VotedUpdated = {
	type: "VotedUpdated";
	image_id: string;
	is_good: boolean;
	is_new: boolean;
	changed: boolean;
};

export type UserBanned = {
	type: "UserBanned";
	his_identifier: string;
};

export type ResolvedUserBan = {
	type: "ResolvedUserBan";
	his_identifier: string;
};

export type RoomDeleted = {
	type: "RoomDeleted";
};

export type OthersJoin = {
	type: "OthersJoin";
};

export type OthersDrop = {
	type: "OthersDrop";
};

export type WsListenerEvent =
	| ImagePosted
	| ImageDeleted
	| CommentPosted
	| CommentDeleted
	| VotedUpdated
	| OthersDrop
	| OthersJoin
	| RoomDeleted
export type WsBanEvent = UserBanned | ResolvedUserBan;

export type WsServerEvent =
	| ImagePosted
	| ImageDeleted
	| CommentPosted
	| CommentDeleted
	| VotedUpdated
	| UserBanned
	| ResolvedUserBan
	| RoomDeleted
	| OthersJoin
	| OthersDrop;
