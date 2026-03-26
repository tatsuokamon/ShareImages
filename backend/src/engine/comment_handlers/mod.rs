use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    engine::{
        EngineErr, EngineState, auth::AuthUser, generate_user_identifier, right_control::User,
    },
    repository::{self, update_post_comment_status},
    ws::broadcast,
};

#[derive(serde::Deserialize)]
pub struct PostCommentQuery {
    room_id: Uuid,
}

#[derive(serde::Deserialize)]
pub struct PostCommentPayload {
    display_name: Option<String>,
    content: String,
}

async fn post_comment_inner(
    q: PostCommentQuery,
    state: EngineState,
    auth: AuthUser,
    payload: PostCommentPayload,
) -> Result<axum::http::StatusCode, EngineErr> {
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if !user.can_post_comment(&state).await? {
        return Ok(axum::http::StatusCode::FORBIDDEN);
    }

    let id = repository::post_comment(
        &state.db,
        user.room_id,
        user.user_id,
        payload.display_name.clone(),
        payload.content.clone(),
    )
    .await?;
    let mut conn = state.pool.get().await?;
    update_post_comment_status(&mut conn, &auth.user_id, state.post_comment_timeout).await?;

    broadcast(
        &state.manager,
        user.room_id,
        crate::ws::ServerEvent::CommentPosted {
            id: id,
            display_name: payload.display_name.unwrap_or("無名".to_string()),
            content: payload.content,
            user_identifier: generate_user_identifier(&auth.user_id),
        },
    );

    Ok(axum::http::StatusCode::OK)
}

pub async fn post_comment(
    Query(q): Query<PostCommentQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
    Json(payload): Json<PostCommentPayload>,
) -> impl IntoResponse {
    match post_comment_inner(q, state, auth, payload).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

#[derive(Deserialize)]
pub struct DeleteCommentQuery {
    pub comment_id: Uuid,
    pub room_id: Uuid,
}

async fn delete_comment_inner(
    q: DeleteCommentQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<axum::http::StatusCode, EngineErr> {
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if !user.can_delete_comment(&state, q.comment_id).await? {
        return Ok(axum::http::StatusCode::FORBIDDEN);
    }

    repository::delete_comment(&state.db, &q.comment_id).await?;
    broadcast(
        &state.manager,
        q.room_id,
        crate::ws::ServerEvent::CommentDeleted { id: q.comment_id },
    );

    Ok(axum::http::StatusCode::OK)
}

pub async fn delete_comment(
    Query(q): Query<DeleteCommentQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match delete_comment_inner(q, state, auth).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}
