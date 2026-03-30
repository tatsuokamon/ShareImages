import {
	Component,
	PostUIManager,
	RoomDOMManager,
	type Controller,
} from "../../shared/ui_manager.js";
import { type ImgMeta } from "../../shared/image.js";
import { Actions } from "../../shared/actions.js";
import {
	create_bad_button,
	create_comment,
	create_display_name,
	create_good_button,
	create_icon,
	create_score,
	render_room_info,
	room_updater,
	score_to_display,
	wrap_as_bubble,
	wrap_as_comment,
	wrap_as_footer,
	wrap_as_img_card,
	wrap_as_meta,
	wrap_as_post,
} from "../../shared/ui_factory.js";
import { Config } from "../../shared/config.js";
import type { CommentMeta } from "../../shared/comment.js";
import { User } from "../../shared/user.js";
import { Room } from "../../shared/room.js";
import { MessageDomManager } from "../../shared/ui_manager.js";
import { URLManager } from "../../shared/api/url_manager.js";
import { post_event_handler } from "../../shared/realtime/ws_handler.js";
import { get_initial_posts } from "../../shared/post.js";
import type { WsServerEvent } from "../../shared/realtime/ws_client.js";

const img_creater = (src: ImgMeta, actions: Actions): HTMLElement => {
	// meta creater
	const meta = wrap_as_meta(
		create_icon(src.display_name),
		create_display_name(src.display_name)
	);

	const title = document.createElement("div");
	title.innerText = src.title ?? "";

	const img_holder = document.createElement("div");
	img_holder.className = "image-placeholder";
	img_holder.innerText = "click and display";

	img_holder.onclick = (e) => {
		const img = document.createElement("img");
		img.src = Config.from_obj_key_to_url(src.object_key);
		img.dataset.id = src.id;
		if (src.user_identifier == actions.user.identifier) {
			img.onclick = (inner_event) => {
				const id = (inner_event.target as HTMLElement)
					.dataset.id;
				if (!id) {
					console.error("no id");
					return;
				}
				actions.delete_image(id);
			};
		}

		(e.target as HTMLElement).replaceWith(img);
	};

	const img_wrapper = wrap_as_img_card(img_holder);

	const score_div = create_score();
	score_div.innerText = score_to_display(src.score);

	const like_button = create_good_button();
	like_button.dataset.img_id = src.id;
	like_button.onclick = (e) => {
		let id = (e.target as HTMLElement).dataset.img_id;
		if (!id) {
			console.error("no id");
			return;
		}
		actions.post_vote({
			img_id: id,
			is_good: true,
		});
	};
	const dislike_button = create_bad_button();
	dislike_button.dataset.img_id = src.id;
	dislike_button.onclick = (e) => {
		let id = (e.target as HTMLElement).dataset.img_id;
		if (!id) {
			console.error("no id");
			return;
		}
		actions.post_vote({
			img_id: id,
			is_good: false,
		});
	};

	const footer = wrap_as_footer([score_div, like_button, dislike_button]);
	return wrap_as_post([meta, title, img_wrapper, footer]);
};

const img_updater = (el: HTMLElement, prev: ImgMeta, next: ImgMeta) => {
	if (prev.score != next.score) {
		let target = el.querySelector(".score");
		if (target) {
			target.textContent = score_to_display(next.score);
		}
	}
};

const img_get_id = (src: ImgMeta): string => {
	return src.id;
};

const comment_creater = (src: CommentMeta, actions: Actions): HTMLElement => {
	const icon = create_icon(src.display_name);
	const display_name = create_display_name(src.display_name);
	const content = create_comment(src.content);

	let bubble = wrap_as_bubble([display_name, content]);
	bubble.dataset.id = src.id;
	if (actions.user.identifier == src.user_identifier) {
		bubble.onclick = (inner_event) => {
			if (inner_event.target !== inner_event.currentTarget)
				return;
			const id = (inner_event.target as HTMLElement).dataset
				.id;
			if (!id) {
				console.error("no id");
				return;
			}
			actions.delete_comment(id);
		};
	}
	return wrap_as_post([wrap_as_comment([icon, bubble])]);
};

const comment_updater = (
	_el: HTMLElement,
	_prev: CommentMeta,
	_next: CommentMeta
) => {};
const get_comment_id = (src: CommentMeta): string => {
	return src.id;
};
export class App {
	user: User | null;
	keyword: string;
	room: Room | null;
	actions: Actions | null;

	message_manager: MessageDomManager | null;
	room_manager: RoomDOMManager | null;
	post_manager: PostUIManager | null;

	socket: WebSocket | null;

	constructor(keyword: string) {
		this.user = null;
		this.keyword = keyword;
		this.room = null;
		this.actions = null;
		this.message_manager = null;
		this.room_manager = null;
		this.post_manager = null;
		this.socket = null;
	}

	async init() {
		try {
			this.user = new User();
			await this.user.init();
			this.room = new Room(this.keyword);
			await this.room.init(this.user as User);
			this.actions = new Actions(this.user, this.room);
			const message_dom = document.getElementById(
				`${Config.messages_dom_id}`
			);
			if (!message_dom) {
				console.error("failed");
				return;
			}
			const room_dom = document.getElementById(
				`${Config.room_dom_id}`
			);
			if (!room_dom) {
				console.error("failed");
				return;
			}
			this.room_manager = new RoomDOMManager(
				room_dom,
				this.room,
				render_room_info,
				room_updater
			);
			const post_dom = document.getElementById(
				Config.post_dom_id
			);
			if (!post_dom) {
				console.error("failed");
				return;
			}
			let post_manager = new PostUIManager(
				post_dom,
				Config.timeout,
				this.actions
			);
			this.post_manager = post_manager;
			let img_controller: Controller<ImgMeta> = {
				create: (src: ImgMeta) =>
					img_creater(
						src,
						this.actions as Actions
					),
				update: img_updater,
				get_id: img_get_id,
			};
			let comment_controller: Controller<CommentMeta> = {
				create: (src: CommentMeta) =>
					comment_creater(
						src,
						this.actions as Actions
					),
				update: comment_updater,
				get_id: get_comment_id,
			};
			this.message_manager = new MessageDomManager(
				message_dom,
				new Component<ImgMeta>(img_controller),
				new Component<CommentMeta>(comment_controller)
			);

			let posts = await get_initial_posts(
				this.user.token,
				this.room.id
			);
			this.message_manager.create_post(posts);

			this.socket = new WebSocket(
				URLManager.get_ws_endpoint(this.room.id, this.user.id)
			);
			this.socket.onmessage = (message) => {
				let e: WsServerEvent = JSON.parse(message.data);
				post_event_handler(
					e,
					this
						.message_manager as MessageDomManager,
					this.room_manager as RoomDOMManager,
					this.room as Room
				);
			};
		} catch (e) {
			alert(e);
		}
	}
}
