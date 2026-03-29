export const Config = {
	host: "https://share_imgs.com/",
	cdn_host: "https://img.share_imgs.com/",
	user_id_store_tag: "USER_ID",
	user_token_store_tag: "USER_TOKEN",
	user_identifier_store_tag: "USER_IDENTIFIER",
	messages_dom_id: "message",
	room_dom_id: "room-info",
	post_dom_id: "bottom_ui",
	ban_dom_id: "ban_list",
	room_endpoint: function(room_id: string) {return `${this.host}room?room_id=${room_id}`},
	master_endpoint: function(room_id: string) {return `${this.host}admin?room_id=${room_id}`},
	timeout: 5,
	max_content: 140,
	max_file_size: 200000,
	from_obj_key_to_url: function (obj_key: string) {
		return `${this.cdn_host}${obj_key}`;
	},
	validate_comment: function(content: string) : boolean{
		return 0 < content.length && content.length < this.max_content
	},
	validate_img: function(file: File): boolean {
		let re = new RegExp(`image.*`)
		return 0 < file.size && file.size < this.max_file_size && re.test(file.type);
	}
};
