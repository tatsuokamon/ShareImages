use std::sync::Arc;

use axum::{Json, Router, middleware, response::IntoResponse, routing};
use bb8::{Pool, RunError};
use bb8_redis::RedisConnectionManager;
use redis::RedisError;
use sea_orm::DatabaseConnection;
use serde::Serialize;
use sha2::Digest;
use uuid::Uuid;

use crate::{
    engine::{
        get_posted_comment::get_posted_comment, get_posted_img::get_posted_img,
        rate_limit::rate_limit_middleware, ws_handler::ws_handler,
    },
    repository::RepositoryErr,
    ws::WsManager,
};

mod auth;
mod rate_limit;
mod right_control;

mod gen_token;

mod get_user_id;

mod get_posted_comment;
mod get_posted_img;

mod ban_handlers;
mod vote_handlers;
mod comment_handlers;
mod image_handlers;
mod room_handler;
mod ws_handler;

type JsonResponse<Response: Serialize> = (axum::http::StatusCode, Json<Response>);

pub struct EngineStateSrc {
    pub db: DatabaseConnection,
    pub sdk_client: aws_sdk_s3::Client,
    pub pool: Pool<RedisConnectionManager>,
    pub manager: WsManager,
    pub bucket_name: String,
    pub expires_in: u64,
    pub post_img_timeout: usize,
    pub post_comment_timeout: usize,
    pub secret: Vec<u8>,
    pub req_per_minute: usize,
}

pub type EngineState = Arc<EngineStateSrc>;

fn generate_user_identifier(user_id: &Uuid) -> String {
    format!("user-{:x}", sha2::Sha256::digest(user_id.as_bytes()))
}

pub fn generate_router(state: EngineState) -> Router {
    Router::new()
        // about user
        .route("/new_user_id", axum::routing::get(get_user_id::get_user_id))
        .route(
            "/ban",
            routing::post(ban_handlers::post_ban_user)
                .delete(ban_handlers::delete_ban_user)
                .get(ban_handlers::get_ban_user),
        )
        // about room
        .route(
            "/room",
            axum::routing::get(room_handler::get_room)
                .delete(room_handler::delete_room)
                .post(room_handler::post_room),
        )
        // about img
        .route(
            "/presigned_url",
            axum::routing::get(image_handlers::get_presigned_url),
        )
        .route(
            "/img",
            axum::routing::post(image_handlers::post_img).delete(image_handlers::delete_img),
        )
        .route("/posted_img", axum::routing::get(get_posted_img))
        .route("/vote", routing::post(vote_handlers::vote))
        // about comment
        .route(
            "/comment",
            axum::routing::post(comment_handlers::post_comment)
                .delete(comment_handlers::delete_comment),
        )
        .route("/posted_comment", axum::routing::get(get_posted_comment))
        // about ws
        .route("/ws", axum::routing::get(ws_handler))
        .layer(middleware::from_fn(rate_limit_middleware))
        .with_state(state)
}

#[derive(thiserror::Error, Debug)]
pub enum EngineErr {
    #[error("EngineErr: RepositoryErr: {0}")]
    RepositoryErr(#[from] RepositoryErr),

    #[error("EngineErr: ReidsError: {0}")]
    RedisError(#[from] RunError<RedisError>),
}
