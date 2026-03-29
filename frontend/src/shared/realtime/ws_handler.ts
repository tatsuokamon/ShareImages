import type { ImgMeta } from "../image";
import type { Room } from "../room";
import type {
	BanDOMManager,
	BanSrc,
	MessageDomManager,
	RoomDOMManager,
} from "../ui_manager";
import type { WsServerEvent } from "./ws_client";

export const post_event_handler = (
	e: WsServerEvent,
	message_manager: MessageDomManager,
	room_manager: RoomDOMManager,
	room: Room
) => {
	switch (e.type) {
		case "ImagePosted": {
			let {
				id,
				title,
				score,
				display_name,
				user_identifier,
				object_key,
				created_at,
			} = e;
			message_manager.create_img({
				id,
				title,
				score,
				display_name,
				user_identifier,
				object_key,
				created_at,
			});
			break;
		}
		case "ImageDeleted": {
			let { id } = e;
			message_manager.delete_img(id);
			break;
		}
		case "CommentPosted": {
			let {
				id,
				display_name,
				content,
				user_identifier,
				created_at,
			} = e;
			message_manager.create_comment({
				id,
				display_name,
				content,
				user_identifier,
				created_at,
			});
			break;
		}
		case "CommentDeleted": {
			let { id } = e;
			message_manager.delete_comment(id);
			break;
		}
		case "VotedUpdated": {
			let { image_id, is_good, is_new, changed } = e;
			let score_diff =
				(is_new ? 1 : 2) *
				(is_good ? 1 : -1) *
				(changed ? 1 : 0);
			if (score_diff != 0) {
				message_manager.update_img(
					image_id,
					(prev: ImgMeta) => {
						return {
							...prev,
							score:
								prev.score +
								score_diff,
						};
					}
				);
			}
			break;
		}
		case "OthersJoin": {
			room_manager.update((prev: Room) => {
				return {
					...prev,
					how_many: prev.how_many + 1,
				} as Room;
			});
			break;
		}

		case "OthersDrop": {
			room_manager.update((prev: Room) => {
				return {
					...prev,
					how_many: prev.how_many - 1,
				} as Room;
			});
			break;
		}
		case "RoomDeleted": {
			room_manager.delete_room();
			break;
		}

		case "UserBanned": {
			if (!room.banned_users.includes(e.his_identifier)) {
				room.banned_users.push(e.his_identifier);
			}
			break;
		}

		case "ResolvedUserBan": {
			let index = room.banned_users.findIndex(
				(obj) => obj == e.his_identifier
			);
			if (0 <= index) {
				room.banned_users.splice(index, 1);
			}
		}
	}
};

export const master_event_handler = (
	e: WsServerEvent,
	message_manager: MessageDomManager,
	room_manager: RoomDOMManager,
	ban_manager: BanDOMManager,
	room: Room
) => {
	switch (e.type) {
		case "ImagePosted": {
			let {
				id,
				title,
				score,
				display_name,
				user_identifier,
				object_key,
				created_at,
			} = e;
			let img_id = message_manager.create_img({
				id,
				title,
				score,
				display_name,
				user_identifier,
				object_key,
				created_at,
			});
			ban_manager.upsert(user_identifier, (src: BanSrc) => {
				src.display_name = display_name;
				src.post_ids.push(img_id);

				return src;
			});
			break;
		}
		case "ImageDeleted": {
			let { id } = e;
			message_manager.delete_img(id);
			break;
		}
		case "CommentPosted": {
			let {
				id,
				display_name,
				content,
				user_identifier,
				created_at,
			} = e;
			let comment_id = message_manager.create_comment({
				id,
				display_name,
				content,
				user_identifier,
				created_at,
			});
			ban_manager.upsert(user_identifier, (src: BanSrc) => {
				src.display_name = display_name;
				src.post_ids.push(comment_id);
				return src;
			});
			break;
		}
		case "CommentDeleted": {
			let { id } = e;
			message_manager.delete_comment(id);
			break;
		}
		case "VotedUpdated": {
			let { image_id, is_good, is_new, changed } = e;
			let score_diff =
				(is_new ? 1 : 2) *
				(is_good ? 1 : -1) *
				(changed ? 1 : 0);
			if (score_diff != 0) {
				message_manager.update_img(
					image_id,
					(prev: ImgMeta) => {
						return {
							...prev,
							score:
								prev.score +
								score_diff,
						};
					}
				);
			}
			break;
		}
		case "OthersJoin": {
			room_manager.update((prev: Room) => {
				return {
					...prev,
					how_many: prev.how_many + 1,
				} as Room;
			});
			break;
		}

		case "OthersDrop": {
			room_manager.update((prev: Room) => {
				return {
					...prev,
					how_many: prev.how_many - 1,
				} as Room;
			});
			break;
		}

		case "RoomDeleted": {
			room_manager.delete_room();
			break;
		}

		case "UserBanned": {
			if (!room.banned_users.includes(e.his_identifier)) {
				room.banned_users.push(e.his_identifier);
				ban_manager.upsert(
					e.his_identifier,
					(src: BanSrc) => {
						src.banned = true;
						return src;
					}
				);
			}
			break;
		}

		case "ResolvedUserBan": {
			let index = room.banned_users.findIndex(
				(obj) => obj == e.his_identifier
			);
			if (0 <= index) {
				room.banned_users.splice(index, 1);
				ban_manager.upsert(
					e.his_identifier,
					(src: BanSrc) => {
						src.banned = false;
						return src;
					}
				);
			}
		}
	}
};
