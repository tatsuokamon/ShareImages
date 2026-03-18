import type { Result } from "./rustic";
import { URLManager } from "./url_manager";

export type User = {
	user_id: string;
	user_identifier: string;
	token: string;
	display_name: string | null
};

type GetUserResult = {
	user_id: string | null,
	user_identifier: string | null,
	token: string | null,
	success: boolean

}

const generate_new_user = async (): Promise<Result<User, number>> => {
	let res = await fetch(URLManager.get_new_user_endpoit());
	if (!res.ok) {
		return {
			type: "err",
			data: res.status
		};
	}
	let result: GetUserResult = await res.json();
	if (!result.success || result.token == null || result.user_id == null || result.user_identifier == null ) {
		return {
			type: "err",
			data: 400 // as bad request
		};
	}

	return {
		type: "ok",
		data: {
			user_id: result.user_id  as string,
			user_identifier: result.user_identifier as  string,
			token: result.token as string,
			display_name: null
		}
	}
}


export const get_user = async  (): Promise<Result<User, number>> => {
	let user_id = localStorage.getItem("user_id");
	let user_identifier = localStorage.getItem("user_identifier");
	let token = localStorage.getItem("token");
	let display_name = localStorage.getItem("display_name");

	if (user_id == null || user_identifier == null || token == null) {
		return await generate_new_user();
	}

	return {
		type: "ok",
		data: {
			user_id: user_id as string,
			user_identifier: user_identifier as string,
			token: token as string,
			display_name
		}
	}

}
