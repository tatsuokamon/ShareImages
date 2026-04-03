export const Config = {
	host: "/",
	api_endpoint: "/api/",
	cdn_host: "https://img.share-imgs.com/",
	user_id_store_tag: "USER_ID",
	user_token_store_tag: "USER_TOKEN",
	user_identifier_store_tag: "USER_IDENTIFIER",
	messages_dom_id: "message",
	room_dom_id: "room-info",
	post_dom_id: "bottom_ui",
	ban_dom_id: "ban_list",
	default_name: "無名",
	room_endpoint: function (keyword: string) {
		return `${this.host}room.html?keyword=${keyword}`;
	},
	master_endpoint: function (keyword: string) {
		return `${this.host}admin.html?keyword=${keyword}`;
	},
	timeout: 5,
	max_content: 400,
	max_file_size: 200000,
	from_obj_key_to_url: function (obj_key: string) {
		return `${this.cdn_host}${obj_key}`;
	},
	validate_comment: function (content: string): boolean {
		return 0 < content.length && content.length < this.max_content;
	},
	validate_img: function (file: File): boolean {
		let re = new RegExp(`image.*`);
		return (
			0 < file.size &&
			file.size < this.max_file_size &&
			re.test(file.type)
		);
	},
	amazon_tag: "shareimages-22",
};
