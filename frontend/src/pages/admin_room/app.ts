import { Actions } from "../../shared/actions.js";
import { URLManager } from "../../shared/api/url_manager.js";
import type { CommentMeta } from "../../shared/comment.js";
import { Config } from "../../shared/config.js";
import type { ImgMeta } from "../../shared/image.js";
import { get_initial_posts } from "../../shared/post.js";
import type { WsServerEvent } from "../../shared/realtime/ws_client.js";
import { master_event_handler } from "../../shared/realtime/ws_handler.js";
import { Room } from "../../shared/room.js";
import {
	render_room_info,
	room_updater,
	score_to_display,
	wrap_as_post,
	create_post_header,
	create_post_body,
	put_me
} from "../../shared/ui_factory.js";
import {
	RoomDOMManager,
	MessageDomManager,
	PostUIManager,
	type Controller,
	Component,
	type BanSrc,
	BanDOMManager,
} from "../../shared/ui_manager.js";
import { User } from "../../shared/user.js";

const img_creater = (src: ImgMeta, actions: Actions): HTMLElement => {
	const header = create_post_header(
		src,
		actions,
		true,
		true
	);
	const body = create_post_body(src, actions);

	const post = wrap_as_post([header, body]);
	if (actions.user.identifier == src.user_identifier) {
		put_me(post);
	}
	return post;
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
	const header = create_post_header(
		src,
		actions,
		true,
		src.user_identifier == actions.user.identifier
	);
	const body = create_post_body(src, actions);

	const post = wrap_as_post([header, body]);
	if (actions.user.identifier == src.user_identifier) {
		put_me(post);
	}
	return post
};

const comment_updater = (
	_el: HTMLElement,
	_prev: CommentMeta,
	_next: CommentMeta
) => {};
const get_comment_id = (src: CommentMeta): string => {
	return src.id;
};

const ban_create = (ban_src: BanSrc, actions: Actions) => {
	const user_div = document.createElement("div");
	user_div.className = "ban-user";
	user_div.innerText = ban_src.display_name;

	const button = document.createElement("button");
	button.innerText = "解除";
	button.dataset.identifier = ban_src.identifier;

	button.onclick = (e) => {
		let target = (e.target as HTMLElement).dataset.identifier;
		if (target) {
			actions.delete_ban({
				user_identifier: target,
				room_id: actions.room.id,
			});
		}
	};

	const wrapper = document.createElement("div");
	wrapper.className = "ban-item";
	wrapper.appendChild(user_div);
	wrapper.appendChild(button);
	wrapper.classList.add("hidden");
	wrapper.dataset.post_ids = JSON.stringify(ban_src);

	// wrapper.onmouseover = (e) => {
	// 	let target = (e.target as HTMLElement).dataset.post_ids;
	// 	if (!target) {
	// 		return;
	// 	}
	// 	let post_ids: string[] = JSON.parse(target);
	//
	// 	post_ids.forEach((id) => {
	// 		if (
	// 			!message_dom_manager.img_component.update_ui(
	// 				id,
	// 				(e: HTMLElement) => {
	// 					e.classList.add(
	// 						"highlightened"
	// 					);
	// 				}
	// 			)
	// 		) {
	// 			message_dom_manager.comment_component.update_ui(
	// 				id,
	// 				(e: HTMLElement) => {
	// 					e.classList.add(
	// 						"highlightened"
	// 					);
	// 				}
	// 			);
	// 		}
	// 	});
	// };
	// wrapper.onmouseout = (e) => {
	// 	let target = (e.target as HTMLElement).dataset.post_ids;
	// 	if (!target) {
	// 		return;
	// 	}
	// 	let post_ids: string[] = JSON.parse(target);
	//
	// 	post_ids.forEach((id) => {
	// 		if (
	// 			!message_dom_manager.img_component.update_ui(
	// 				id,
	// 				(e: HTMLElement) => {
	// 					e.classList.remove(
	// 						"highlightened"
	// 					);
	// 				}
	// 			)
	// 		) {
	// 			message_dom_manager.comment_component.update_ui(
	// 				id,
	// 				(e: HTMLElement) => {
	// 					e.classList.remove(
	// 						"highlightened"
	// 					);
	// 				}
	// 			);
	// 		}
	// 	});
	// };
	return wrapper;
};

const update_ban = (el: HTMLElement, prev: BanSrc, next: BanSrc) => {
	if (prev.banned != next.banned) {
		if (next.banned) {
			el.classList.remove("hidden");
		} else {
			el.classList.add("hidden");
		}
	}

	// if (prev.post_ids != next.post_ids) {
	// 	el.dataset.post_ids = JSON.stringify(next.post_ids);
	// }
	//
	if (prev.display_name != next.display_name) {
		let target = el.querySelector(".ban-user");
		if (target) {
			target.textContent = next.display_name;
		}
	}
};

const get_ban_id = (src: BanSrc) => src.identifier;

export class App {
	user: User | null;
	keyword: string;
	room: Room | null;
	actions: Actions | null;

	message_manager: MessageDomManager | null;
	room_manager: RoomDOMManager | null;
	post_manager: PostUIManager | null;
	ban_manager: BanDOMManager | null;

	socket: WebSocket | null;

	constructor(keyword: string) {
		this.user = null;
		this.keyword = keyword;
		this.room = null;
		this.actions = null;
		this.message_manager = null;
		this.room_manager = null;
		this.post_manager = null;
		this.ban_manager = null;
		this.socket = null;
	}

	async init() {
		try {
			this.user = new User();
			await this.user.init();
			this.room = new Room(this.keyword);
			await this.room.init(this.user as User);

			// check if he is authorized
			if (!this.room.as_master) {
				location.assign(Config.room_endpoint(this.keyword));
			}

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
			let ban_controller: Controller<BanSrc> = {
				create: (src: BanSrc) =>
					ban_create(
						src,
						this.actions as Actions
					),
				update: update_ban,
				get_id: get_ban_id,
			};
			let ban_dom = document.getElementById(
				Config.ban_dom_id
			);
			if (!ban_dom) return;
			this.ban_manager = new BanDOMManager(
				ban_dom,
				new Component<BanSrc>(ban_controller)
			);

			let posts = await get_initial_posts(
				this.user.token,
				this.room.id
			);
			let maps: Map<string, BanSrc> =
				this.message_manager.create_post(posts);
			maps.forEach((value, key) => {
				this.ban_manager?.upsert(
					key,
					(_src: BanSrc) => {
						return value;
					}
				);
			});
			this.room.banned_users.forEach((u) => {
				this.ban_manager?.upsert(u, (src: BanSrc) => {
					return { ...src, banned: true };
				});
			});
			this.socket = new WebSocket(
				URLManager.get_ws_endpoint(
					this.room.id,
					this.user.id
				)
			);

			this.socket.onmessage = (message) => {
				let e: WsServerEvent = JSON.parse(message.data);
				master_event_handler(
					e,
					this
						.message_manager as MessageDomManager,
					this.room_manager as RoomDOMManager,
					this.ban_manager as BanDOMManager,
					this.room as Room
				);
			};
			this.socket.onclose = () => {
				alert("connection closed");
				location.assign(Config.host);
			}

			this.socket.onerror = (e) => {
				console.error(e);
				if (this.socket) {
					this.socket.close();
				} else {
					alert("connection closed");
					location.assign(Config.host);
				}
			}
		} catch (e) {
			alert(e);
		}
	}
}
