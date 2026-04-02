import type { Room } from "./room.js";
import { Config } from "./config.js";
import { type ImgMeta } from "./image.js";
import { Actions } from "./actions.js";
import { type Post } from "./post.js";

export const create_icon = (
	display_name: string | null,
	identifier: string,
) => {
	const icon = document.createElement("div");
	icon.className = "icon";
	icon.innerText = (
		display_name ? display_name : Config.default_name
	).substring(0, 1);
	icon.style.setProperty(
		"--icon-color",
		color_from_identifier(identifier)
	);

	return icon;
};

export const create_display_name = (
	display_name: string | null
): HTMLElement => {
	const div = document.createElement("div");
	div.className = "display-name";
	div.innerText = display_name ? display_name : Config.default_name;

	return div;
};

export const score_to_display = (score: number): string => {
	return `★${score}`;
};

export const create_score = (): HTMLElement => {
	const div = document.createElement("div");

	div.className = "score";
	return div;
};

export const create_good_button = (
	src: ImgMeta,
	actions: Actions
): HTMLElement => {
	const button = document.createElement("button");

	button.classList.add("reaction-btn");
	button.classList.add("like");

	button.dataset.id = src.id;
	button.innerText = "(・∀・)ｲｲﾈ!!"
	button.onclick = (e) => {
		let target = e.target;
		if (target) {
			let id = (target as HTMLElement).dataset.id;
			if (id) {
				actions.post_vote({
					img_id: id,
					is_good: true,
				});

				button.classList.add("liked");
				let parent = button.parentElement;
				if (parent) {
					let dislike_btn = parent.querySelector(
						"button.reaction-btn.dislike"
					);
					if (dislike_btn) {
						dislike_btn.classList.remove(
							"disliked"
						);
					}
				}
			}
		}
	};

	return button;
};

export const create_bad_button = (
	src: ImgMeta,
	actions: Actions
): HTMLElement => {
	const button = document.createElement("button");

	button.classList.add("reaction-btn");
	button.classList.add("dislike");

	button.dataset.id = src.id;
	button.innerText = "('ω'乂)"
	button.onclick = (e) => {
		let target = e.target;
		if (target) {
			let id = (target as HTMLElement).dataset.id;
			if (id) {
				actions.post_vote({
					img_id: id,
					is_good: false,
				});

				button.classList.add("disliked");
				let parent = button.parentElement;
				if (parent) {
					let dislike_btn = parent.querySelector(
						"button.reaction-btn.like"
					);
					if (dislike_btn) {
						dislike_btn.classList.remove(
							"liked"
						);
					}
				}
			}
		}
	};

	return button;
};

const create_raw_comment = (content: string) => {
	const div = document.createElement("div");
	div.innerText = content;
	div.className = "content";

	return div;
};

export const create_comment = (content: string) => {
	return create_raw_comment(content);
};

export const wrap_as = (
	es: HTMLElement[],
	setup_wrapper: (e: HTMLElement) => void
): HTMLElement => {
	const div = document.createElement("div");
	setup_wrapper(div);
	es.forEach((e) => div.appendChild(e));
	return div;
};

export const wrap_as_comment = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "comment"));
};

export const create_post_header = (
	src: Post,
	actions: Actions,
	with_ban: boolean,
	with_delete: boolean
): HTMLElement => {
	const div = document.createElement("div");
	div.className = "post-header";

	let icon = create_icon(src.display_name, src.user_identifier);
	if (with_ban) {
		icon.dataset.identifier = src.user_identifier;
		icon.onclick = (e) => {
			let target = e.target;
			if (target) {
				let identifier = (target as HTMLElement).dataset.identifier;
				if (identifier) {
					actions.post_ban(identifier);
				}
			}
		}
	}
	div.appendChild(icon);
	div.appendChild(create_display_name(src.display_name));

	if (with_delete) {
		const button = document.createElement("button");
		button.className = "delete-btn";
		button.innerText = "x";
		button.dataset.id = src.id;

		button.onclick = (e) => {
			let target = e.target;
			if (target) {
				let id = (target as HTMLElement).dataset.id;
				if (id) {
					if ("object_key" in src) {
						actions.delete_image(id);
					} else {
						actions.delete_comment(id);
					}
				}
			}
		};
		div.appendChild(button)
	}
	return div;
};

export const wrap_as_post_body = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "post-body"));
};

export const wrap_as_post = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "post"));
};

export const wrap_as_img_card = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "image-card"));
};

export const wrap_as_footer = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "card-footer"));
};

export const wrap_as_bubble = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "bubble"));
};

export const create_img_title = (title: string | null): HTMLElement => {
	const div = document.createElement("div");
	div.className = "image-title";
	div.innerText = title ?? "";

	return div;
};

export const create_img_placeholder = (src: ImgMeta): HTMLElement => {
	const div = document.createElement("div");
	div.className = "image-placeholder";
	div.innerText = "click and display";

	div.onclick = (e) => {
		const img = document.createElement("img");
		img.className = "image";
		img.crossOrigin = "anonymous";
		img.src = Config.from_obj_key_to_url(src.object_key);
		(e.target as HTMLElement).replaceWith(img);
	};

	return div;
};

export const render_room_info = (room_info: Room, target: HTMLElement) => {
	const label_div = document.createElement("div");
	label_div.className = "room-label";

	const center_div = document.createElement("div");
	center_div.className = "room-center";
	center_div.innerHTML = `同接: <output id="connections">${room_info.how_many}</output> `;

	const keyword_box = document.createElement("div");
	keyword_box.className = "room-keyword-box";

	const keyword_label = document.createElement("div");
	keyword_label.className = "keyword-label";
	keyword_label.innerText = "keyword";

	const keyword_div = document.createElement("div");
	keyword_div.innerText = room_info.keyword;
	keyword_div.className = "keyword";
	keyword_div.onclick = (e) => {
		if (navigator.clipboard)
			navigator.clipboard.writeText(
				(e.target as HTMLElement).innerText
			);
	};

	keyword_box.appendChild(keyword_label);
	keyword_box.appendChild(keyword_div);

	target.appendChild(label_div);
	target.appendChild(center_div);
	target.appendChild(keyword_box);
};

export const room_updater = (el: HTMLElement, prev: Room, next: Room) => {
	if (prev.how_many != next.how_many) {
		(el.querySelector("#connections") as HTMLElement).innerText =
			next.how_many.toString();
	}
};

export const wrap_as_comment_card = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "comment-card"));
};

export const put_me = (el: HTMLElement) => {
	el.classList.add("me");
};

const string_to_hue = (s: string): number => {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) % 360;
	}
	return h;
};

const color_from_identifier = (identifier: string): string => {
	const hue = string_to_hue(identifier);

	return `hsl(${hue} 70% 55%)`;
};

export const create_post_body = (
	src: Post,
	actions: Actions,
): HTMLElement => {

	if ("object_key" in src ){
		const title = create_img_title(src.title);

		const img_holder = create_img_placeholder(src);
		const img_wrapper = wrap_as([img_holder], e => e.className = "image-wrapper");

		const score_div = create_score();
		score_div.innerText = score_to_display(src.score);

		const like_button = create_good_button(src, actions);
		const dislike_button = create_bad_button(src, actions);

		const footer = wrap_as_footer([score_div, like_button, dislike_button]);
		const img_card = wrap_as_img_card([title, img_wrapper, footer]);

		const body = wrap_as_post_body([img_card]);
		return body;
	} else {
		const content = create_comment(src.content);
		let comment_card = wrap_as_comment_card([ content ]);
		const body = wrap_as_post_body([comment_card])

		return body;
	}
};
