use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use bb8::RunError;
use redis::RedisError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    engine::{EngineErr, EngineState, auth::AuthUser, right_control::User},
    repository::{check_if_img_vote_exists, upsert_img_vote},
    ws::broadcast,
};

#[derive(Deserialize)]
pub struct VoteQuery {
    pub room_id: Uuid,
}

#[derive(Deserialize)]
pub struct VotePayload {
    pub img_id: Uuid,
    pub is_good: bool,
}

pub async fn vote(
    Query(q): Query<VoteQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
    Json(payload): Json<VotePayload>,
) -> impl IntoResponse {
    match _vote_inner(q, state, auth, payload).await {
        Ok(res) => res,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn _vote_inner(
    q: VoteQuery,
    state: EngineState,
    auth: AuthUser,
    payload: VotePayload,
) -> Result<axum::http::StatusCode, EngineErr> {
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if !user.can_vote(&state, payload.img_id).await? {
        return Ok(axum::http::StatusCode::FORBIDDEN);
    }

    let img_vote_op = check_if_img_vote_exists(&state.db, auth.user_id, payload.img_id).await?;
    let is_new = img_vote_op.is_none();
    let changed = if is_new {
        false
    } else {
        img_vote_op.clone().unwrap().is_good != payload.is_good
    };

    if !changed && !is_new {
        return Ok(axum::http::StatusCode::OK);
    }

    upsert_img_vote(
        &state.db,
        img_vote_op,
        auth.user_id,
        payload.img_id,
        payload.is_good.clone(),
    )
    .await?;

    broadcast(
        &state.manager,
        q.room_id,
        crate::ws::ServerEvent::VotedUpdated {
            image_id: payload.img_id,
            is_good: payload.is_good,
            is_new: is_new,
            changed: changed,
        },
    );

    Ok(axum::http::StatusCode::OK)
}
