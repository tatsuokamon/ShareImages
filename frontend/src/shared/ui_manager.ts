import { type ImgMeta } from "./image";
import { type CommentMeta } from "./comment";
import type { Post } from "./post";
import { Config } from "./config";
import type {
	Actions,
	GetURLResp,
	PostCommentPayload,
	PostImgPayload,
} from "./actions";
import type { Room } from "./room";

export type Controller<Source> = {
	create(src: Source): HTMLElement;
	update(el: HTMLElement, prev: Source, next: Source): void;
	get_id(src: Source): string;
};

export class Component<Source> {
	private elem_index = new Map<string, HTMLElement>();
	private state_index = new Map<string, Source>();
	private controller: Controller<Source>;

	constructor(controller: Controller<Source>) {
		this.controller = controller;
	}

	has_id(id: string) {
		return this.elem_index.has(id) && this.state_index.has(id);
	}

	// WARN!! when target is DocumentFragment, just update state and no ui change
	add(src: Source, target: HTMLElement | DocumentFragment): string {
		const el = this.controller.create(src);
		const id = this.controller.get_id(src);

		this.elem_index.set(id, el);
		this.state_index.set(id, src);

		target.appendChild(el);

		return id;
	}

	delete(id: string): string | null{
		const el = this.elem_index.get(id);
		if (!el) return null;

		el.remove();

		this.elem_index.delete(id);
		this.state_index.delete(id);

		return id;
	}

	upsert(src: Source, target: HTMLElement) :string {
		const id = this.controller.get_id(src);

		const prev_state = this.state_index.get(id);
		const el = this.elem_index.get(id);
		if (!prev_state || !el) {
			return this.add(src, target);
		}

		return this.update(id, (_prev: Source) => {
			return src;
		}) as string;
	}

	update(id: string, state_updater: (prev: Source) => Source): string | null {
		const prev_state = this.state_index.get(id);
		const el = this.elem_index.get(id);
		if (!prev_state || !el) return null;

		const next_state = state_updater(prev_state);
		this.controller.update(el, prev_state, next_state);
		this.state_index.set(id, next_state);

		return id;
	}

	update_ui(
		id: string,
		elem_updater: (elem: HTMLElement) => void
	): boolean {
		const prev_state = this.state_index.get(id);
		const el = this.elem_index.get(id);
		if (!prev_state || !el) return false;
		elem_updater(el);
		return true;
	}
}

const post_id_to_map = (id: string, post: Post, map: Map<string, BanSrc>) => {
	let got = map.get(post.user_identifier);
	if (got) {
		got.post_ids.push(id)
		got.display_name = post.display_name;
	} else {
		let src : BanSrc = {
			identifier: post.user_identifier,
			display_name: post.display_name,
			banned: false,
			post_ids: [id]
		}
		map.set(post.user_identifier, src)
	}
}

export class MessageDomManager {
	private dom: HTMLElement;
	img_component: Component<ImgMeta>;
	comment_component: Component<CommentMeta>;

	constructor(
		dom: HTMLElement,
		img_component: Component<ImgMeta>,
		comment_component: Component<CommentMeta>
	) {
		this.dom = dom;
		this.img_component = img_component;
		this.comment_component = comment_component;
	}

	create_img(meta: ImgMeta): string {
		return this.img_component.add(meta, this.dom);
	}

	update_img(id: string, updater: (prev: ImgMeta) => ImgMeta) {
		return this.img_component.update(id, updater);
	}

	delete_img(id: string): string| null {
		return this.img_component.delete(id);
	}

	create_comment(meta: CommentMeta): string {
		return this.comment_component.add(meta, this.dom);
	}

	delete_comment(id: string) {
		return this.comment_component.delete(id);
	}

	create_post(posts: Post[]) :Map<string, BanSrc>{
		const frag = document.createDocumentFragment();
		let response = new Map<string, BanSrc>();
		posts.forEach((post) => {
			if ("object_key" in post) {
				let id = this.img_component.add(post, frag);
				post_id_to_map(id, post, response)
			} else {
				let id = this.comment_component.add(post, frag);
				post_id_to_map(id, post, response)
			}
		});

		this.dom.appendChild(frag);
		return response;
	}
}

export type BanSrc = {
	identifier: string;
	post_ids: string[];
	display_name: string;
	banned: boolean;
};

export class BanDOMManager {
	private dom: HTMLElement;
	private component: Component<BanSrc>;

	constructor(dom: HTMLElement, component: Component<BanSrc>) {
		this.dom = dom;
		this.component = component;
	}

	upsert(identifier: string, updater: (prev: BanSrc) => BanSrc) {
		if (this.component.has_id(identifier)) {
			this.component.update(identifier, updater);
		} else {
			let default_src = {
				identifier,
				post_ids: [],
				display_name: "無名",
				banned: false,
			};
			this.component.add( updater(default_src), this.dom)
		}
	}
}

export class RoomDOMManager {
	private dom: HTMLElement;
	private status: Room;
	private renderer: (status: Room, target: HTMLElement) => void;
	private updater: (elem: HTMLElement, prev: Room, next: Room) => void;

	constructor(
		dom: HTMLElement,
		status: Room,
		renderer: (status: Room, target: HTMLElement) => void,
		updater: (elem: HTMLElement, prev: Room, next: Room) => void
	) {
		this.dom = dom;
		this.status = status;
		this.renderer = renderer;
		this.updater = updater;

		this.renderer(this.status, this.dom);
	}

	update(updater: (prev: Room) => Room) {
		const prev = this.status;
		const next = updater(this.status);

		this.status = next;
		this.updater(this.dom, prev, next);
	}

	delete_room() {
		alert("ROOM DELETED");
		location.assign(Config.host);
	}
}
export class PostUIManager {
	private dom: HTMLElement;
	private actions: Actions;
	private timeout_sec: number;

	private file: File | null = null;

	constructor(dom: HTMLElement, timeout_sec: number, actions: Actions) {
		this.dom = dom;
		this.actions = actions;
		this.timeout_sec = timeout_sec;

		this.dom.innerHTML = `
		<div class="upload-preview hidden" id="upload_preview">

		<img
		id="preview_img"
		class="preview-img"
		/>

		<div class="preview-meta">
		<div
		class="preview-title"
		id="preview_title"
		></div>
		</div>

		<button
		id="preview_cancel"
		class="preview-cancel"
		>
		×
		</button>

		</div>

		<input
		id="display_name"
		class="name-input"
		placeholder="your name"
		/>

		<div class="message-bar">

		<label class="file-btn">
		+
			<input
		id="file_input"
		type="file"
		class="file-input"
		accept="image/*"
		/>
		</label>

		<input
		id="message_input"
		class="message-input"
		placeholder="comment or image title"
		/>

		<button
		id="send_btn"
		class="send-btn"
		>
		✈
		</button>

		</div>



`;

		this.bind_events();
	}

	/* ---------------- bind ---------------- */

	private bind_events() {
		this.get_file_input().onchange = this.on_file_change;

		this.get_cancel_btn().onclick = this.remove_preview;

		this.get_send_btn().onclick = this.on_submit;

		this.get_message_input().oninput = this.sync_preview_title;
	}

	/* ---------------- dom getter ---------------- */

	private get_file_input() {
		return this.dom.querySelector(
			"#file_input"
		) as HTMLInputElement;
	}

	private get_message_input() {
		return this.dom.querySelector(
			"#message_input"
		) as HTMLInputElement;
	}

	private get_display_name_input() {
		return this.dom.querySelector(
			"#display_name"
		) as HTMLInputElement;
	}

	private get_preview_div() {
		return this.dom.querySelector(
			"#upload_preview"
		) as HTMLDivElement;
	}

	private get_preview_img() {
		return this.dom.querySelector(
			"#preview_img"
		) as HTMLImageElement;
	}

	private get_preview_title() {
		return this.dom.querySelector(
			"#preview_title"
		) as HTMLDivElement;
	}

	private get_cancel_btn() {
		return this.dom.querySelector(
			"#preview_cancel"
		) as HTMLButtonElement;
	}

	private get_send_btn() {
		return this.dom.querySelector("#send_btn") as HTMLButtonElement;
	}

	/* ---------------- preview ---------------- */

	private on_file_change = () => {
		let file = this.get_file_input().files?.[0];

		if (!file) return;

		if (!Config.validate_img(file)) {
			alert("invalid image");

			return;
		}

		this.file = file;

		let reader = new FileReader();

		reader.onload = () => {
			this.get_preview_img().src = reader.result as string;

			this.sync_preview_title();

			this.show_preview();
		};

		reader.readAsDataURL(file);
	};

	private sync_preview_title = () => {
		if (!this.file) return;

		let title = this.get_message_input().value;

		this.get_preview_title().textContent = title || this.file.name;
	};

	private show_preview() {
		this.get_preview_div().classList.remove("hidden");
	}

	private remove_preview = () => {
		this.file = null;

		this.get_preview_div().classList.add("hidden");

		this.get_file_input().value = "";
	};

	private has_image(): boolean {
		return this.file != null;
	}

	/* ---------------- payload ---------------- */

	private get_comment_payload(): PostCommentPayload | null {
		let display_name = this.get_display_name_input().value;

		let content = this.get_message_input().value;

		if (!Config.validate_comment(content)) {
			alert("invalid comment");

			return null;
		}

		return {
			display_name,

			content,
		};
	}

	private async get_image_payload(): Promise<PostImgPayload | null> {
		if (!this.file) return null;

		let comment_payload = this.get_comment_payload();

		if (!comment_payload) return null;

		let presigned_resp = await this.actions.get_presigned_url();

		if (!presigned_resp.ok) {
			alert("failed");

			return null;
		}

		let url_json: GetURLResp = await presigned_resp.json();

		if (
			!url_json.success ||
			!url_json.presigned_url ||
			!url_json.key
		) {
			alert("failed");

			return null;
		}

		let upload_resp = await this.actions.upload_image(
			this.file,
			url_json.presigned_url
		);

		if (!upload_resp.ok) {
			alert("upload failed");

			return null;
		}

		return {
			display_name: comment_payload.display_name,

			title: comment_payload.content,

			key: url_json.key,
		};
	}

	/* ---------------- submit ---------------- */

	private on_submit = async () => {
		if (!this.actions.can_post()) {
			alert("You're banned");
			return;
		}
		this.disable_button();

		try {
			if (this.has_image()) {
				let payload = await this.get_image_payload();

				if (!payload){  return };

				let resp =
					await this.actions.post_image(payload);

				if (!resp.ok) throw "post failed";
			} else {
				let payload = this.get_comment_payload();

				if (!payload) return;

				let resp =
					await this.actions.post_comment(
						payload
					);

				if (!resp.ok) throw "post failed";
			}

			this.reset_form();
		} catch {
			alert("post failed");
		}
	};

	/* ---------------- reset ---------------- */

	private reset_form() {
		this.get_message_input().value = "";

		this.remove_preview();
	}

	/* ---------------- anti spam ---------------- */

	private disable_button() {
		let btn = this.get_send_btn();

		btn.disabled = true;

		setTimeout(() => {
			btn.disabled = false;
		}, this.timeout_sec * 1000);
	}
}
