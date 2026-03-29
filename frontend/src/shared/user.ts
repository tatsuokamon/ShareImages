import { URLManager } from "./api/url_manager";
import { Config } from "./config";

export class User {
	id = "";
	identifier = "";
	token = "";

	constructor() {}

	async init() {
		await get_user(this);
	}
}

type GetUserResult = {
	user_id: string | null;
	user_identifier: string | null;
	token: string | null;
	success: boolean;
};

const get_user = async (user: User) => {
	let id = localStorage.getItem(Config.user_id_store_tag);
	let token = localStorage.getItem(Config.user_token_store_tag);
	let identifier = localStorage.getItem(Config.user_identifier_store_tag);

	if (!id || !token || !identifier) {
		await fetch(URLManager.users_endpoint())
			.then(async (res) => {
				if (!res.ok) {
					throw new Error("");
				}
				return await res.json();
			})
			.then((result: GetUserResult) => {
				if (
					!result.success ||
					!result.user_id ||
					!result.token ||
					!result.user_identifier
				) {
					throw new Error("");
				}

				user.id = result.user_id;
				user.token = result.token;
				user.identifier = result.user_identifier;

				localStorage.setItem(
					Config.user_id_store_tag,
					user.id
				);
				localStorage.setItem(
					Config.user_token_store_tag,
					user.token
				);
				localStorage.setItem(
					Config.user_identifier_store_tag,
					user.identifier
				);
			});
	} else {
		user.id = id;
		user.token = token;
		user.identifier = identifier;
	}
};
