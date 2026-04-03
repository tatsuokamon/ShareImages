import { type OEmbedResponse } from "./model.js";

const get_oembeded_endpoint = (url: string): string | null => {
	if (url.includes("youtube.com") || url.includes("youtu.be")) {
		return `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
	}
	if (url.includes("x.com")) {
		return `https://publish.x.com/oembed?url=${encodeURIComponent(url)}`;
	}

	return null;
};

export const fetchPreview = async (
	url: string
): Promise<OEmbedResponse | null> => {
	const endpoint = get_oembeded_endpoint(url);
	if (!endpoint) {
		return null;
	}

	const res = await fetch(endpoint);
	if (!res.ok) return null;

	const data: OEmbedResponse = await res.json();

	return data;
};
