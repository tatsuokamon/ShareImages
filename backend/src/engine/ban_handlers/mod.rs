use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use uuid::Uuid;

use crate::{
    engine::{
        EngineErr, EngineState,
        auth::AuthUser,
        right_control::{AccessControl, User},
    },
    repository::{self, get_all_banned_users},
    ws::broadcast,
};

#[derive(serde::Deserialize)]
pub struct BanControlQuery {
    pub user_identifier: String,
    pub room_id: Uuid,
}

async fn post_ban_user_inner(
    q: BanControlQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<axum::http::StatusCode, EngineErr> {
    // validate
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if let AccessControl::Denied(status) = user.can_ban_user(&state).await? {
        return Ok(status);
    }

    // exectute
    let mut conn = state.pool.get().await?;
    repository::ban_user(&mut conn, q.room_id, &q.user_identifier).await?;

    // broadcast
    broadcast(
        &state.manager,
        q.room_id,
        crate::ws::ServerEvent::UserBanned {
            his_identifier: q.user_identifier,
        },
    );

    Ok(axum::http::StatusCode::OK)
}

pub async fn post_ban_user(
    Query(q): Query<BanControlQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match post_ban_user_inner(q, state, auth).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn delete_ban_user_inner(
    q: BanControlQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<axum::http::StatusCode, EngineErr> {
    // validate
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if let AccessControl::Denied(status) = user.can_ban_user(&state).await? {
        return Ok(status);
    }

    // exectute
    let mut conn = state.pool.get().await?;
    repository::resolve_ban(&mut conn, q.room_id, &q.user_identifier).await?;

    // broadcast
    broadcast(
        &state.manager,
        q.room_id,
        crate::ws::ServerEvent::ResolvedUserBan {
            his_identifier: q.user_identifier,
        },
    );

    Ok(axum::http::StatusCode::OK)
}

pub async fn delete_ban_user(
    Query(q): Query<BanControlQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match delete_ban_user_inner(q, state, auth).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

#[derive(serde::Deserialize)]
pub struct GetBanUsersQuery {
    pub room_id: Uuid,
}

#[derive(serde::Serialize)]
pub struct BannedUsersResp {
    pub success: bool,
    pub banned_users: Option<Vec<String>>,
}

async fn get_ban_user_inner(
    q: GetBanUsersQuery,
    state: EngineState,
) -> Result<(axum::http::StatusCode, Json<BannedUsersResp>), EngineErr> {
    let mut conn = state.pool.get().await?;
    Ok((
        axum::http::StatusCode::OK,
        Json(BannedUsersResp {
            banned_users: get_all_banned_users(&mut conn, q.room_id).await?,
            success: true,
        }),
    ))
}

pub async fn get_ban_user(
    Query(q): Query<GetBanUsersQuery>,
    State(state): State<EngineState>,
) -> impl IntoResponse {
    match get_ban_user_inner(q, state).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(BannedUsersResp {
                    banned_users: None,
                    success: false,
                }),
            )
        }
    }
}
