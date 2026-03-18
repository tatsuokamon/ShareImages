import { add_event, invoke_socket } from "./invoke_ws";
import { PostManager, type Post } from "./post_manager";
import { find_room_with_keyword, type Room } from "./room";
import { URLManager } from "./url_manager";
import { get_user, type User } from "./user";
import { type PostCommentQuery } from "./comment";
import type { GetPresignedURLResponse } from "./image_meta";
import type { Result } from "./rustic";

export type Config = {
	post_comment_timeout: number;
	post_img_timeout: number;
	max_comment_length: number;
	max_size: number;
};

export type HTTPError = number;
export type OK = "ok";
export type Status = HTTPError | OK;

export type CommentErr =
	| "No User"
	| "No Room"
	| "No User OR No Room"
	| number
	| "InvalidComment"
	| "During Timeout"
	| "Not Authorized";
export type GetPresignedURLErr =
	| number
	| "No User"
	| "No Room"
	| "During Timeout"
	| "Not Authorized"
	| "No User OR No Room"
	| "Too Bid Size"
	| "Response Not Success";
export type PostImageErr =
	| number
	| "No Presigned URL"
	| "No User"
	| "No Room"
	| "Not Authorized"
	| "No User OR No Room";

export class State {
	config: Config;
	user: User | null;
	comment: string;
	title: string;
	joining_room: Room | null;
	displaying_posts: Post[];
	status: Status;
	socket: WebSocket | null;
	waited_img_timeout: boolean;
	waited_comment_timeout: boolean;
	holding_presigned_url: string | null;

	_room_deleted_operation: (state: State) => void;

	constructor(
		config: Config,
		room_deleted_operation: (state: State) => void 
	) {
		this.config = config;
		this.user = null;
		this.joining_room = null;
		this.displaying_posts = [];
		this.status = "ok";
		this.socket = null;
		this._room_deleted_operation = room_deleted_operation;
		this.waited_img_timeout = true;
		this.waited_comment_timeout = true;

		this.comment = "";
		this.title = ""
		this.holding_presigned_url = null;
	}

	init(keyword: string | null) {
		this.status = "ok";
		this.user = null;
		this.joining_room = null;
		this.displaying_posts = [];

		get_user().then((result) => {
			if (result.type == "err") {
				this.status = result.data;
				return;
			} else {
				this.user = result.data;
			}
			if (keyword) {
				find_room_with_keyword(
					(this.user as User).user_id,
					keyword as string
				).then((result) => {
					if (result.type == "err") {
						this.status = result.data;
						return;
					} else {
						this.joining_room = result.data;
						this.join_room_as_slave();
					}
				});
			}
		});
	}

	_disable_comment() {
		this.waited_comment_timeout = false;
		setTimeout(() => {
			this.waited_comment_timeout = true;
		}, this.config.post_comment_timeout);
	}

	_disable_post_image() {
		this.waited_img_timeout = false;
		setTimeout(() => {
			this.waited_img_timeout = true;
		}, this.config.post_img_timeout);
	}

	_start_socket() {
		if (this.socket != null) {
			console.error(
				"socket is not null but start_socket called"
			);
			return;
		}
		this.socket = invoke_socket(this.user as User, this.joining_room as Room);
		add_event(this.socket, this);
	}

	_close_socket() {
		if (this.socket == null) {
			console.error("socket is null but stop_socket called");
			return;
		}

		this.socket.close();
		this.socket = null;
	}

	_check_if_user_room_exists(): boolean {
		return this.user != null && this.joining_room != null;
	}

	_i_can_post(): boolean {
		return (
			this._check_if_user_room_exists() &&
			!(this.joining_room as Room).banned_user.includes(
				(this.user as User).user_identifier
			)
		);
	}

	async get_presigned_url(
		failed_callback: (err: GetPresignedURLErr) => void,
		size: number
	) {
		if (this.config.max_size < size) {
			failed_callback("Too Bid Size");
			return;
		}
		if (!this._check_if_user_room_exists()) {
			failed_callback("No User OR No Room");
			return;
		}

		if (!this._i_can_post()) {
			failed_callback("Not Authorized");
			return;
		}

		if (!this.waited_img_timeout) {
			failed_callback("During Timeout");
			return;
		}

		let res = await PostManager.get_presigned_url(
			{
				room_id: (this.joining_room as Room).id,
			},
			(this.user as User).token
		);

		if (!res.ok) {
			failed_callback(res.status);
			return;
		}

		let result: GetPresignedURLResponse = await res.json();
		if (!result.success || !result.presigned_url) {
			failed_callback("Response Not Success");
			return;
		}

		this.holding_presigned_url = result.presigned_url as string;
		this._disable_post_image();
	}

	async _post_image_inner(): Promise<Result<number,PostImageErr>> {
		if (!this._check_if_user_room_exists()) {
			return {
				type: "err",
				data: "No User OR No Room"
			};
		}
		if (!this._i_can_post()) {
			return {
				type: "err",
				data: "Not Authorized"
			}
		}
		// presigned url process
		let res = await PostManager.post_img({
			room_id: (this.joining_room as Room).id,
			presigned_url: this.holding_presigned_url as string,
			display_name: (this.user as User).display_name,
			title: this.title
		}, (this.user as User).token);

		if (!res.ok) {
			return {
				type: "err",
				data: res.status
			}
		}

		return {
			type: "ok",
			data: 0
		}
	}

	async post_image(failed_callback: (err: PostImageErr) => void) {
		let result = await this._post_image_inner();
		if (result.type == "err") {
			failed_callback(result.data);
			return;
		}

		this.holding_presigned_url = null;
	}


	async post_comment(failed_callback: (err: CommentErr) => void) {
		if (!this._check_if_user_room_exists()) {
			failed_callback("No User OR No Room");
			return;
		}
		if (!this._i_can_post()) {
			failed_callback("Not Authorized");
			return;
		}
		if (!this.waited_comment_timeout) {
			failed_callback("During Timeout");
			return;
		}

		if (this.config.max_comment_length < this.comment.length) {
			failed_callback("InvalidComment");
			return;
		}

		let req = PostManager.create_comment_request(
			(this.user as User).display_name,
			this.comment
		);
		let query: PostCommentQuery = {
			room_id: (this.joining_room as Room).id,
		};

		let res = await PostManager.post_comment(
			(this.user as User).token,
			req,
			query
		);
		if (!res.ok) {
			failed_callback(res.status);
		}

		this._disable_comment();
	}

	async join_room_as_slave_with_keyword(keyword: string) {
		find_room_with_keyword(
			(this.user as User).user_id,
			keyword as string
		).then((result) => {
			if (result.type == "err") {
				this.status = result.data;
				return;
			} else {
				this.joining_room = result.data;
				this.join_room_as_slave();
			}
		});
	}

	async join_room_as_slave() {
		if (!this._check_if_user_room_exists()) {
			console.error(
				"room or user not existed but join_room_as_slave called"
			);
			return;
		}
		let posted_result = await PostManager.get_posted_post(
			(this.joining_room as Room).id
		);
		if (posted_result.type == "err") {
			console.error("error while get posted result");
			this.status = posted_result.data;
			return;
		}

		this.displaying_posts = posted_result.data;
		this._start_socket();
	}

	laeve_room_as_slave() {
		this._close_socket();
		this.joining_room = null;
		this.displaying_posts = [];
		this.status = "ok";
	}

	room_deleted_operation() {
		this._room_deleted_operation(this);
	}
}
