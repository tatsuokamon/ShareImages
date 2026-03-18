export class ImageMeta {
	id: string;
	title: string | null;
	object_key: string;
	created_at: number | null;
	score: number;

	constructor(
		id: string,
		title: string | null,
		object_key: string,
		created_at: number | null,
		score: number | undefined | null
	) {
		this.id = id;
		this.title = title;
		this.object_key = object_key;
		this.created_at = created_at;
		this.score = score ? score : 0;
	}
}

export type GetPresignedURLQuery = {
	room_id: string;
};

export type GetPresignedURLResponse = {
	presigned_url: string | null;
	success: boolean;
};

export type PostImgQuery = {
	room_id: string;
	title: string | null;
	presigned_url: string;
	display_name: string | null;
};

export type PostedImgResult = {
	success: boolean;
	payload: ImageMeta[];
};
