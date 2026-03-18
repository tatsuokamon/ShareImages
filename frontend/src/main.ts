import Alpine from "alpinejs";
import { State, type CommentErr, type GetPresignedURLErr, type PostImageErr } from "./state";

const POST_COMMENT_TIMEOUT = 1000;
const POST_IMAGE_TIMEOUT = 1000;
const MAX_COMMENT_LENGTH = 140;
const MAX_SIZE = 400;

(window as any).app = function() {
	const state = new State(
		{
			post_comment_timeout: POST_COMMENT_TIMEOUT,
			post_img_timeout: POST_IMAGE_TIMEOUT,
			max_comment_length: MAX_COMMENT_LENGTH,
			max_size: MAX_SIZE
		},
		(state: State) => {
			alert("ROOM DELETED");
			state.laeve_room_as_slave();
		}
	) ;

	return {
		state,

		init() {
			this.state.init(null);
		},

		async join_room_as_slave_with_keyword(keyword: string) {
			await this.state.join_room_as_slave_with_keyword(keyword)
		},

		async post_img() {
			await this.state.post_image((err: PostImageErr) => {
				alert(err)
			})
		},
		async get_presigned_url(size: number) {
			await this.state.get_presigned_url((err: GetPresignedURLErr) => {
				alert(err)
			}, size);
		},

		async post_comment() {
			await this.state.post_comment((err: CommentErr) => {
				alert(err)
			});
		}
	}
}


window.Alpine = Alpine;
Alpine.start();
