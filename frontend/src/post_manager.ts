import {
	CommentMeta,
	type CommentRequestPayload,
	type PostCommentQuery,
} from "./comment";

import {
	ImageMeta,
	type GetPresignedURLQuery,
	type PostImgQuery,
} from "./image_meta";
import type { Room } from "./room";
import type { Result } from "./rustic";
import { URLManager } from "./url_manager";
import type {
	CommentDeletedEvent,
	CommentPostedEvent,
	ImageDeletedEvent,
	ImagePostedEvent,
	ResolveUerBanEvent,
	UserBannedEvent,
	VotedUpdatedEvent,
} from "./ws_event";
export type Post = CommentMeta | ImageMeta;

async function get_posted(target_url: string): Promise<Result<Post[], number>> {
	let posted_res = await fetch(target_url);
	if (!posted_res.ok) {
		return {
			type: "err",
			data: posted_res.status,
		};
	}
	let posted_result = await posted_res.json();
	if (!posted_result.success) {
		return {
			type: "err",
			data: 400, // as bad request
		};
	}

	return {
		type: "ok",
		data: posted_result.payload,
	};
}
export class PostManager {
	static create_comment_request(
		display_name: string | null,
		content: string
	): CommentRequestPayload {
		return {
			display_name,
			content,
		};
	}

	static async post_comment(
		token: string,
		request: CommentRequestPayload,
		query: PostCommentQuery
	): Promise<Response> {
		return await fetch(URLManager.post_comment_endpoint(query), {
			method: "POST",
			body: JSON.stringify(request),
			headers: {
				"Authorization": `Bearer ${token}`
			}
		});
	}

	static async get_presigned_url(
		query: GetPresignedURLQuery,
		token: string
	): Promise<Response> {
		let res = await fetch(
			URLManager.get_presigned_url_endpoint(query),
			{
				headers: {
					"Authorization": `Bearer ${token}`
				}
			}
		);
		return await res.json();
	}

	static async post_img(query: PostImgQuery, token: string): Promise<Response> {
		return await fetch(URLManager.post_img_endpoint(query), {
			headers: {
				"Authorization": `Bearer ${token}`
			} 
		});
	}

	static async get_posted_post(
		roomId: string
	): Promise<Result<Post[], number>> {
		let posted_imgs = await get_posted(
			URLManager.get_posted_img_endpoint(roomId)
		);
		if (posted_imgs.type == "err") {
			return posted_imgs;
		}

		let posted_comments = await get_posted(
			URLManager.get_posted_comment_endpoint(roomId)
		);
		if (posted_comments.type == "err") {
			return posted_comments;
		}

		let posts = [] as Post[];
		posts = posts.concat(posted_imgs.data, posted_comments.data);
		posts.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));

		return {
			type: "ok",
			data: posts,
		};
	}

	static add_img(e: ImagePostedEvent, posted_data: Post[]): void {
		posted_data.push(
			new ImageMeta(e.id, e.title, e.object_key, null, null)
		);
	}

	static remove_img(e: ImageDeletedEvent, posted_data: Post[]): void {
		let index = posted_data.findIndex(
			(elem) =>
				elem.id == e.id &&
				elem instanceof ImageMeta
		);
		if (index < -1) {
			console.error(
				"socket seems to have sent not existing image id"
			);
			return;
		}

		posted_data.splice(index, 1);
	}

	static add_comment(e: CommentPostedEvent, posted_data: Post[]): void {
		posted_data.push(
			new CommentMeta(e.id, e.content, e.display_name, null)
		);
	}
	static remove_comment(
		e: CommentDeletedEvent,
		posted_data: Post[]
	): void {
		let index = posted_data.findIndex(
			(elem) =>
				elem.id == e.id &&
				elem typeof CommentMeta
		);
		if (index < -1) {
			console.error(
				"socket seems to have sent not existing comment id"
			);
			return;
		}

		posted_data.splice(index, 1);
	}

	static reflect_vote(e: VotedUpdatedEvent, posts: Post[]) {
		let index = posts.findIndex(
			(elem) =>
				elem.id == e.image_id &&
				typeof elem == ImageMeta.toString()
		);
		if (index < -1) {
			console.error(
				"socket seems to have sent not existing image id"
			);
			return;
		}
		(posts[index] as ImageMeta).score +=
			(e.is_good ? 1 : -1) *
			(e.is_new ? 1 : e.changed ? 2 : 0);
	}

	static add_ban_user(e: UserBannedEvent, room: Room) {
		if (
			0 <=
			room.banned_user.findIndex(
				(elem) => elem == e.his_identifier
			)
		) {
			console.error(
				"socket seems to have sent already banned user identifier"
			);
		} else {
			room.banned_user.push(e.his_identifier);
		}
	}

	static remove_ban_user(e: ResolveUerBanEvent, room: Room) {
		let index = room.banned_user.findIndex(
			(elem) => elem == e.his_identifier
		);
		if (index < 0) {
			console.error(
				"socket seems to have sent not banned user identifier"
			);
		} else {
			room.banned_user.splice(index, 1);
		}
	}
}
