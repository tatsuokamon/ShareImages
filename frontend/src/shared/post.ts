import { gen_authorization, URLManager } from "./api/url_manager";
import type { CommentMeta } from "./comment";
import type { ImgMeta } from "./image";

export type Post = ImgMeta | CommentMeta;

export async function get_initial_posts(
	token: string,
	room_id: string
): Promise<Post[]> {
	const img_promise = fetch(
		URLManager.get_posted_image_endpoint({ room_id }),
		{
			method: "GET",
			headers: {
				Authorization: gen_authorization(token),
			},
		}
	).then((resp) => {
		if (!resp.ok) {
			console.error("failed");
			throw new Error("");
		}
		return resp.json();
	});

	const comment_promise = fetch(
		URLManager.get_posted_comment_endpoint({ room_id }),
		{
			method: "GET",
			headers: {
				Authorization: gen_authorization(token),
			},
		}
	).then((resp) => {
		if (!resp.ok) {
			console.error("failed");
			throw new Error("");
		}
		return resp.json();
	});
	const [imgs, comment] = await Promise.all([
		img_promise,
		comment_promise,
	]);
	const post_result: Post[] = (imgs ?? []).concat(comment ?? []);
	post_result.sort((a: Post, b: Post) => a.created_at - b.created_at);

	return post_result;
}
