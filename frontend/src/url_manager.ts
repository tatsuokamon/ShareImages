import type { PostCommentQuery } from "./comment";
import type { GetPresignedURLQuery, PostImgQuery } from "./image_meta";

export class URLManager {
	static API = "";
	static post_comment_endpoint(
		postCommentQuery: PostCommentQuery
	): string {
		return `${this.API}/comment?roomId=${postCommentQuery.room_id}`;
	}
	static get_presigned_url_endpoint(
		getPresignedURLQuery: GetPresignedURLQuery
	): string {
		return `${this.API}/presigned_url?room_id=${getPresignedURLQuery.room_id}`;
	}
	static post_img_endpoint(postImgQuery: PostImgQuery): string {
		let url = `${this.API}/comment?room_id=${postImgQuery.room_id}&presigned_url=${postImgQuery.presigned_url}`;

		if (postImgQuery.title) {
			url += `&title=${postImgQuery.title}`;
		}

		if (postImgQuery.display_name) {
			url += `&display_name=${postImgQuery.display_name}`;
		}

		return url;
	}

	static get_posted_img_endpoint(roomId: string): string {
		return `${this.API}/posted_img?room_id=${roomId}`;
	}

	static get_posted_comment_endpoint(roomId: string): string {
		return `${this.API}/posted_comment?room_id=${roomId}`;
	}

	static get_new_user_endpoit(): string {
		return `${this.API}/new_user_id`;
	}

	static get_room_id_endpoint(user_id: string, keyword: string): string {
		return `${this.API}/room?user_id=${user_id}&keyword=${keyword}`;
	}

	static ws_endpoint(room_id: string, user_id: string): string {
		return `${this.API}/ws?room_id=${room_id}&user_id=${user_id}`;
	}

	static get_ban_users_endpoint(room_id: string): string {
		return `${this.API}/ban?room_id=${room_id}`;
	}
}
