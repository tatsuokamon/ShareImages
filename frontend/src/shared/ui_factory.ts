import type { Room } from "./room";

export const create_icon = (display_name: string | null) => {
	const icon = document.createElement("div");
	icon.className = "icon";
	icon.innerText = (display_name ?? "無名").substring(0, 1);

	return icon;
};

export const create_display_name = (display_name: string): HTMLElement => {
	const div = document.createElement("div");
	div.className = "display-name";
	div.innerText = display_name;

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

export const create_good_button = (): HTMLElement => {
	const button = document.createElement("button");

	button.classList.add("reaction-btn");
	button.classList.add("like");

	return button;
};

export const create_bad_button = (): HTMLElement => {
	const button = document.createElement("button");

	button.classList.add("reaction-btn");
	button.classList.add("dislike");

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

export const wrap_as_meta = (
	icon: HTMLElement,
	display_name: HTMLElement
): HTMLElement => {
	const div = document.createElement("div");
	div.className = "meta";
	div.appendChild(icon);
	div.appendChild(display_name);
	return div;
};
export const wrap_as_post = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "post"));
};

export const wrap_as_img_card = (e: HTMLElement): HTMLElement => {
	const div = document.createElement("div");
	div.className = "image-card";
	div.appendChild(e);
	return div;
};

export const wrap_as_footer = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "footer"));
};

export const wrap_as_bubble = (es: HTMLElement[]): HTMLElement => {
	return wrap_as(es, (e: HTMLElement) => (e.className = "bubble"));
};

export const render_room_info = (
	room_info: Room,
	target: HTMLElement
) => {
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
		navigator.clipboard.writeText((e.target as HTMLElement).innerText)
	}

	keyword_box.appendChild(keyword_label);
	keyword_box.appendChild(keyword_div);

	target.appendChild(label_div);
	target.appendChild(center_div);
	target.appendChild(keyword_box);
};

export const room_updater = (el: HTMLElement, prev: Room, next: Room) => {
	if (prev.how_many!= next.how_many) {
		(el.querySelector("#connections") as HTMLElement).innerText = next.how_many.toString();
	}
}
