use axum::{
    extract::{Query, State, WebSocketUpgrade},
    response::IntoResponse,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{engine::EngineState, repository::check_if_he_exists, ws::handle_socket};

#[derive(Deserialize)]
pub struct WsParams {
    pub room_id: Uuid,
    pub user_id: Uuid,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(q): Query<WsParams>,
    State(state): State<EngineState>,
) -> impl IntoResponse {
    match check_if_he_exists(&state.db, q.user_id).await {
        Ok(true) => {
            if let Some(room) = state.manager.rooms.get(&q.room_id) {
                if room.get(&q.user_id).is_some() {
                    return axum::http::StatusCode::BAD_REQUEST.into_response();
                }
            }

            let moved_state = state.clone();
            ws.on_upgrade(move |socket| async move {
                let state = moved_state;
                handle_socket(socket, q.room_id, q.user_id, &state.manager).await;
            })
            .into_response()
        }
        Ok(false) => axum::http::StatusCode::BAD_REQUEST.into_response(),
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
