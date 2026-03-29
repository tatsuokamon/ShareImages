import { Config } from "../config";

export const gen_authorization = (token: string): string => {
	return `Bearer ${token}`;
};
export class URLManager {
	static users_endpoint = (): string => {
		return `${Config.api_endpoint}new_user_id`;
	};

	static ban_endpoint = (): string => {
		return `${Config.api_endpoint}ban`;
	};

	static genreate_get_ban_endpoint = (q: GetBanQuery): string => {
		return `${this.ban_endpoint()}?room_id=${q.room_id}`;
	};

	static genreate_delete_ban_endpoint = (q: BanControlQuery): string => {
		return `${this.ban_endpoint()}?user_identifier=${q.user_identifier}&room_id=${q.room_id}`;
	};

	static genreate_post_ban_endpoint = (q: BanControlQuery): string => {
		return `${this.ban_endpoint()}?user_identifier=${q.user_identifier}&room_id=${q.room_id}`;
	};

	static room_endpoint = (): string => {
		return `${Config.api_endpoint}room`;
	};

	static get_room_endpoint = (q: GetRoomQuery): string => {
		return `${this.room_endpoint()}?keyword=${q.keyword}`;
	};

	static post_room_endpoint = (): string => {
		return `${this.room_endpoint()}`;
	};

	static delete_room_endpoint = (q: DeleteRoomQuery): string => {
		return `${this.room_endpoint()}?room_id=${q.room_id}`;
	};

	static presigned_url_endpoint = (): string => {
		return `${Config.api_endpoint}presigned_url`;
	};

	static get_presigned_url_endpoint = (
		q: GetPresignedURLQuery
	): string => {
		return `${this.presigned_url_endpoint()}?room_id=${q.room_id}`;
	};

	static image_endpoint = (): string => {
		return `${Config.api_endpoint}img`;
	};

	static delete_image_endpoint = (q: DeleteImageQuery) => {
		return `${this.image_endpoint()}?img_id=${q.img_id}&room_id=${q.room_id}`;
	};

	static post_image_endpoint = (q: PostImageQuery) => {
		let url = `${this.image_endpoint()}?room_id=${q.room_id}`;

		return url;
	};

	static posted_image_endpoint = (): string => {
		return `${Config.api_endpoint}posted_img`;
	};

	static get_posted_image_endpoint = (q: GetPostedImageQuery): string => {
		return `${this.posted_image_endpoint()}?room_id=${q.room_id}`;
	};

	static comment_endpoint = (): string => {
		return `${Config.api_endpoint}comment`;
	};

	static post_comment_endpoint = (q: PostCommentQuery): string => {
		return `${this.comment_endpoint()}?room_id=${q.room_id}`;
	};

	static delete_comment_endpoint = (q: DeleteCommentQuery): string => {
		return `${this.comment_endpoint()}?room_id=${q.room_id}&comment_id=${q.comment_id}`;
	};

	static posted_comment_endpoint = (): string => {
		return `${Config.api_endpoint}posted_comment`;
	};

	static get_posted_comment_endpoint = (
		q: GetPostedCommentQuery
	): string => {
		return `${this.posted_comment_endpoint()}?room_id=${q.room_id}`;
	};

	static vote_endpoint = (): string => {
		return `${Config.api_endpoint}vote`;
	};

	static post_vote_endpoint = (q: VoteQuery): string => {
		return `${this.vote_endpoint()}?room_id=${q.room_id}`;
	};

	static ws_endpoint = (): string => {
		return `${Config.api_endpoint}ws`;
	};

	static get_ws_endpoint = (room_id: string, user_id: string): string => {
		return `${this.ws_endpoint()}?room_id=${room_id}&user_id=${user_id}`.replace(
			"https://",
			"wss://"
		);
	};
}

// about ban
export type GetBanQuery = {
	room_id: string;
};

export type BanControlQuery = {
	user_identifier: string;
	room_id: string;
};

// about room
export type GetRoomQuery = {
	keyword: string;
};

export type DeleteRoomQuery = {
	room_id: string;
};

// about get presigned url
export type GetPresignedURLQuery = {
	room_id: string;
};

// about comment
export type PostCommentQuery = {
	room_id: string;
};

export type DeleteCommentQuery = {
	room_id: string;
	comment_id: string;
};

export type GetPostedCommentQuery = {
	room_id: string;
};

// about image
export type DeleteImageQuery = {
	img_id: string;
	room_id: string;
};

export type PostImageQuery = {
	room_id: string;
};

export type GetPostedImageQuery = {
	room_id: string;
};

// about vote
export type VoteQuery = {
	room_id: string;
};

// ws
export type WSQuery = {
	room_id: string;
};

export type APIQueries =
	| PostImageQuery
	| DeleteImageQuery
	| BanControlQuery
	| GetBanQuery
	| VoteQuery
	| WSQuery
	| GetPostedImageQuery
	| GetPostedCommentQuery
	| GetRoomQuery
	| DeleteRoomQuery;

export async function fetch_with_token<Query>(
	token: string,
	q: Query,
	f: (arg0: Query) => string,
	method: string
): Promise<Response> {
	return await fetch(f(q), {
		method,
		headers: {
			Authorization: gen_authorization(token),
		},
	});
}
