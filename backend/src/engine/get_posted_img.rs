use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{engine::EngineState, entity::images, repository};

#[derive(Deserialize)]
pub struct GetPostedImgQuery {
    pub room_id: Uuid,
}

pub async fn get_posted_img(
    Query(q): Query<GetPostedImgQuery>,
    State(state): State<EngineState>,
) -> impl IntoResponse {
    match repository::get_posted_imgs(&state.db, q.room_id).await {
        Ok(v) => (axum::http::StatusCode::OK, Json(Some(v))),
        Err(e) => {
            tracing::error!("{e}");
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(None))
        }
    }
}
