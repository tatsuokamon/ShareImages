import { PostManager } from "./post_manager";
import type { Room } from "./room";
import type { State } from "./state";
import type { User } from "./user";
import type { WsEvent } from "./ws_event";
import { type Result } from "./rustic";
import { URLManager } from "./url_manager";

export const invoke_socket = (user: User, room: Room): WebSocket => {
	return new WebSocket(
		URLManager.ws_endpoint(room.id, user.user_id)
	);
};

export const add_event = (socket: WebSocket, state: State) => {
	if (state.joining_room == null) {
		console.error("room is null, but socket connected");
		return;
	}
	if (state.user == null) {
		console.error("user is null, but socket connected");
		return;
	}
	socket.onmessage((event: string) => {
		const message: WsEvent = JSON.parse(event.data);
		if (state.joining_room == null) {
			console.error("room is null, but socket connected");
			return;
		}
		if (state.user == null) {
			console.error("user is null, but socket connected");
			return;
		}
		switch (message.type) {
			case "ImagePosted": {
				PostManager.add_img(
					message,
					state.displaying_posts
				);
				break;
			}

			case "ImageDeleted": {
				PostManager.remove_img(
					message,
					state.displaying_posts
				);
				break;
			}

			case "CommentPosted": {
				PostManager.add_comment(
					message,
					state.displaying_posts
				);
				break;
			}

			case "CommentDeleted": {
				PostManager.remove_comment(
					message,
					state.displaying_posts
				);
				break;
			}

			case "VotedUpdated": {
				PostManager.reflect_vote(
					message,
					state.displaying_posts
				);
				break;
			}

			case "UserBanned": {
				PostManager.add_ban_user(
					message,
					state.joining_room as Room
				);
				break;
			}
			case "ResolveUerBan": {
				PostManager.remove_ban_user(
					message,
					state.joining_room as Room
				);
				break;
			}
			case "RoomDeleted": {
				state.room_deleted_operation();
				break;
			}

			case "OthersJoin": {
				(state.joining_room as Room).how_many += 1;
				break;
			}

			case "OthersDrop": {
				(state.joining_room as Room).how_many -= 1;
			}
		}
	});
};
