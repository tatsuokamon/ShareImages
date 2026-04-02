import {
	URLManager,
	type GetRoomQuery,
	type GetBanQuery,
	gen_authorization,
} from "./api/url_manager.js";
import type { User } from "./user.js";

type GetRoomResult = {
	room_id: string | null;
	success: boolean;
	how_many: number;
	as_master: boolean;
};

type GetBanUserResult = {
	success: boolean;
	banned_users: null | string[];
};

export class Room {
	id = "";
	keyword = "";
	how_many = 0;
	banned_users = [] as string[];
	as_master: boolean = false;

	constructor(keyword: string) {
		this.keyword = keyword;
	}
	async init(user: User) {
		let get_room_q: GetRoomQuery = {
			keyword: this.keyword,
		};
		await fetch(URLManager.get_room_endpoint(get_room_q), {
			headers: {
				Authorization: gen_authorization(user.token),
			},
		})
			.then((res) => {
				if (!res.ok) {
					throw new Error("");
				}
				return res.json();
			})
			.then((result: GetRoomResult) => {
				if (!result.success || !result.room_id) {
					throw new Error("");
				}

				this.id = result.room_id;
				this.how_many = result.how_many;
				this.as_master = result.as_master;
			})
			.then(async (_) => {
				let get_ban_q: GetBanQuery = {
					room_id: this.id,
				};
				await fetch(
					URLManager.genreate_get_ban_endpoint(
						get_ban_q
					),
					{
						headers: {
							Authorization:
								gen_authorization(
									user.token
								),
						},
					}
				)
					.then((res) => {
						if (!res.ok) {
							throw new Error("");
						}
						return res.json();
					})
					.then((result: GetBanUserResult) => {
						if (
							!result.success 						) {
							throw new Error("");
						}

						this.banned_users =
							result.banned_users ?? [];
					});
			});
	}
}
