import type { Result } from "./rustic"
import { URLManager } from "./url_manager"

type GetBanUserResult = {
	success: boolean, 
	banned_users: string[] | null
}

export const get_banned_users = async (room_id: string): Promise<Result<string[], number>> => {
	let res = await fetch(URLManager.get_ban_users_endpoint(room_id));
	if (!res.ok) {
		return {
			type: "err",
			data: res.status
		}
	}

	let result: GetBanUserResult  = await res.json();
	if (result.banned_users == null) {
		return {
			type: "err",
			data: 400 // as bad request
		}
	}

	return {
		type: "ok",
		data: result.banned_users as string[]
	}
}
