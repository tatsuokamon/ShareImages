import { User } from "./user.js";
import { Room } from "./room.js";
import { gen_authorization, type BanControlQuery } from "./api/url_manager.js";
import { fetch_with_token, URLManager } from "./api/url_manager.js";

export class Actions {
	user: User;
	room: Room;

	constructor(user: User, room: Room) {
		this.user = user;
		this.room = room;
	}

	can_post(): boolean {
		return !this.room.banned_users.includes(
			this.user.identifier
		);
	}

	async post_ban(user_identifier: string): Promise<Response> {
		return await fetch_with_token(
			this.user.token,
			{
				user_identifier,
				room_id: this.room.id
			},
			URLManager.genreate_post_ban_endpoint.bind(URLManager),
			"POST"
		);
	}

	async delete_ban(q: BanControlQuery): Promise<Response> {
		return await fetch_with_token(
			this.user.token,
			q,
			URLManager.genreate_delete_ban_endpoint.bind(URLManager),
			"DELETE"
		);
	}

	async delete_room(room_id: string): Promise<Response> {
		return await fetch_with_token(
			this.user.token,
			{
				room_id: room_id,
			},
			URLManager.delete_room_endpoint.bind(URLManager),
			"DELETE"
		);
	}

	async get_presigned_url(): Promise<Response> {
		return await fetch_with_token(
			this.user.token,
			{
				room_id: this.room.id,
			},
			URLManager.get_presigned_url_endpoint.bind(URLManager),
			"GET"
		);
	}

	async delete_image(img_id: string): Promise<Response> {
		return await fetch_with_token(
			this.user.token,
			{
				img_id: img_id,
				room_id: this.room.id,
			},
			URLManager.delete_image_endpoint.bind(URLManager),
			"DELETE"
		);
	}

	async post_image(payload: PostImgPayload): Promise<Response> {
		return await fetch(
			URLManager.post_image_endpoint({
				room_id: this.room.id,
			}),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: gen_authorization(
						this.user.token
					),
				},
				body: JSON.stringify(payload),
			}
		);
	}

	async post_comment(payload: PostCommentPayload): Promise<Response> {
		return await fetch(
			URLManager.post_comment_endpoint({
				room_id: this.room.id,
			}),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: gen_authorization(
						this.user.token
					),
				},
				body: JSON.stringify(payload),
			}
		);
	}

	async delete_comment(com_id: string): Promise<Response> {
		return await fetch_with_token(
			this.user.token,
			{
				room_id: this.room.id,
				comment_id: com_id,
			},
			URLManager.delete_comment_endpoint.bind(URLManager),
			"DELETE"
		);
	}

	async post_vote(payload: PostVotePayload): Promise<Response> {
		return fetch(
			URLManager.post_vote_endpoint({
				room_id: this.room.id,
			}),
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: gen_authorization(
						this.user.token
					),
				},
				body: JSON.stringify(payload),
				method: "POST"
			}
		);
	}

	async upload_image(
		file: File,
		presigned_url: string
	): Promise<Response> {
		return await fetch(presigned_url, {
			method: "PUT",
			body: file,
			headers: {
				"Content-Type": file.type,
			},
		});
	}
}

export type PostCommentPayload = {
	display_name: string | null;
	content: string;
};

export type PostImgPayload = {
	display_name: string | null;
	title: string | null;
	key: string;
};

export type PostVotePayload = {
	is_good: boolean;
	img_id: string;
};

export type GetURLResp = {
	presigned_url: string | null;
	key: string | null;
	success: boolean;
};
