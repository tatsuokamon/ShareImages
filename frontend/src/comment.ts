export type PostCommentQuery = {
	room_id: string
}

export type CommentRequestPayload = {
	display_name: string | null;
	content: string;
};

export class CommentMeta {
	id: string;
	content: string;
	display_name: string | null;
	created_at: number | null;

	constructor(id: string, content: string, display_name: string | null, created_at: number | null) {
		this.id = id;
		this.content = content;
		this.display_name = display_name;
		this.created_at = created_at;
	}
}
