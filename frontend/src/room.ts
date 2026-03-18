import { get_banned_users } from "./ban_user";
import type { Ok, Result } from "./rustic";
import { URLManager } from "./url_manager";

export type Room = {
	keyword: string;
	id: string;
	banned_user: string[];
	how_many: number;
};

type FindRoomWithKeyWordResult = {
	room_id: string | null,
	success: boolean,
	how_many: number
}

export const find_room_with_keyword = async (user_id: string, keyword: string) : Promise<Result<Room, number>> => {
	let res = await fetch(
		URLManager.get_room_id_endpoint(user_id, keyword)
	);
	if (!res.ok) {
		return {
			type: "err",
			data: res.status
		}
	}

	let result: FindRoomWithKeyWordResult  = await res.json();
	if (!result.success || !result.room_id == null) {
		return {
			type: "err",
			data: 400 // as bad req
		}
	}

	let room_id = result.room_id  as  string;
	let banned_user_result = await get_banned_users(room_id);
	if (banned_user_result.type == "err") {
		return banned_user_result
	}
	return {
		type: "ok",
		data: {
			id: room_id,
			keyword: keyword,
			banned_user: (banned_user_result as Ok<string[]>).data,
			how_many: result.how_many
		}
	}
}

