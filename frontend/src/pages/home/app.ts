import { gen_authorization, URLManager } from "../../shared/api/url_manager.js";
import { Config } from "../../shared/config.js";
import { User } from "../../shared/user.js";

type PostRoomResp = {
	room_id: string | null;
	keyword: string | null;
	success: boolean;
};

type GetRoomResp = {
	room_id: string | null;
	how_many: number;
	success: boolean;
	as_master: boolean;
};

const post_room = async (user: User): Promise<PostRoomResp> => {
	let resp = await fetch(URLManager.post_room_endpoint(), {
		headers: {
			Authorization: gen_authorization(user.token),
		},
		method: "POST",
	});

	if (!resp.ok) throw new Error("");
	return await resp.json();
};

const get_room = async (user: User, keyword: string): Promise<GetRoomResp> => {
	let resp = await fetch(URLManager.get_room_endpoint({ keyword }), {
		headers: {
			Authorization: gen_authorization(user.token),
		},
		method: "GET",
	});
	if (!resp.ok) throw new Error("");
	return await resp.json();
};

export class App {
	user: User | null;
	pass_timeout: boolean = true;

	constructor() {
		this.user = null;
	}

	async init() {
		this.user = new User();
		await this.user.init();
		this.set_event();
	}

	get_keyword(): string {
		return (
			document.getElementById(
				"keyword_input"
			) as HTMLInputElement
		).value;
	}

	private set_event() {
		let listener_btn = document.getElementById("listener_btn")
		if (listener_btn) {
			listener_btn.onclick = async () => {
				this.enter_as_listener()
			}
		}

		let master_join_btn = document.getElementById("master_join_btn")
		if (master_join_btn) {
			master_join_btn.onclick = async () => {
				this.enter_as_master()
			}
		}

		let master_create_btn = document.getElementById("master_create_btn")
		if (master_create_btn) {
			master_create_btn.onclick = async () => {
				this.post_room_and_enter()
			}
		}
	}

	private disable_event() {
		this.pass_timeout = false;
		setTimeout(() => {
			this.pass_timeout = true;
		}, Config.timeout * 1000);
	}

	private async enter_as_listener() {
		try {
			if (!this.pass_timeout) {
				return;
			}
			this.disable_event();
			let keyword = this.get_keyword();
			if (!this.user) throw new Error("");
			let resp = await get_room(this.user as User, keyword);
			if (!resp.room_id) throw new Error("");
			location.assign(Config.room_endpoint(keyword));
		} catch {
			alert("FAILED WHILE ENTER");
		}
	}

	private async enter_as_master() {
		try {
			if (!this.pass_timeout) return;
			this.disable_event();

			if (!this.user) throw new Error("");
			let keyword = this.get_keyword();
			let resp = await get_room(this.user as User, keyword);
			if (!resp.room_id) throw new Error("");
			if (resp.as_master) {
				location.assign(Config.master_endpoint(keyword));
			} else {
				alert("FAILED WHILE ENTER");
			}
		} catch {
			alert("FAILED WHILE ENTER");
		}
	}

	private async post_room_and_enter() {
		try {
			if (!this.pass_timeout) return;
			this.disable_event();

			if (!this.user) throw new Error("");
			let resp = await post_room(this.user)
			if (!resp.keyword) throw new Error("")
			location.assign(Config.master_endpoint(resp.keyword))
		} catch {
			alert("FAILED WHILE ENTER");
		}
	}
}
