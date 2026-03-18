use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    engine::EngineState,
    repository::{RepositoryErr, get_room_id_from_keyword},
};

#[derive(thiserror::Error, Debug)]
pub enum GetRoomErr {
    #[error("GetRoomErr: FromRepositoryErr: {0}")]
    FromRepositoryErr(#[from] RepositoryErr),
}

#[derive(Deserialize)]
pub struct GetRoomQuery {
    pub user_id: Uuid,
    pub keyword: String,
}

#[derive(Serialize)]
pub struct GetRoomResult {
    pub room_id: Option<Uuid>,
    pub success: bool,
    pub how_many: usize
}

pub async fn get_room(
    Query(q): Query<GetRoomQuery>,
    State(state): State<EngineState>,
) -> impl IntoResponse {
    match _get_room_inner(q, state).await {
        Ok(res) => res,
        Err(e) => {
            tracing::error!("{e}");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(GetRoomResult {
                    room_id: None,
                    how_many: 0,
                    success: false,
                }),
            )
        }
    }
}

async fn _get_room_inner(
    q: GetRoomQuery,
    state: EngineState,
) -> Result<(axum::http::StatusCode, Json<GetRoomResult>), GetRoomErr> {
    Ok(
        if let Some(room_id) = get_room_id_from_keyword(&state.db, &q.keyword).await? {
            (
                axum::http::StatusCode::OK,
                Json(GetRoomResult {
                    room_id: Some(room_id),
                    success: true,
                    how_many: state.manager.rooms.get(&room_id).unwrap().len()
                }),
            )
        } else {
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(GetRoomResult {
                    room_id: None,
                    how_many: 0,
                    success: false,
                }),
            )
        },
    )
}
