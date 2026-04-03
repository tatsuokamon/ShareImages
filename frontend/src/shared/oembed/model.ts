export type OEmbedResponse = {
	type: "video" | "photo" | "rich" | "link";
	title: string;

	author_name?: string;
	provider_name?: string;
	thumbnail_url?: string;
	thumbnail_width?: number;
	thumbnail_height?: number;
	html?: string;
	width?: number;
	height?: number;
};
