use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use base64::{Engine, prelude::BASE64_URL_SAFE};
use rand::Rng;
use sea_orm::ConnectionTrait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    engine::{
        EngineErr, EngineState, JsonResponse,
        auth::AuthUser,
        right_control::{AccessControl, User},
    },
    repository::{
        self, check_if_he_is_authorized, check_is_keyword_available, generate_room,
        get_room_id_from_keyword,
    },
    ws::broadcast,
};

fn gen_temp_keyword() -> String {
    let mut bytes = [0u8; 12];
    rand::rng().fill_bytes(&mut bytes);
    BASE64_URL_SAFE.encode(bytes.as_ref())
}

async fn gen_keyword(db: &impl ConnectionTrait) -> Result<String, EngineErr> {
    let mut keyword: String;

    loop {
        keyword = gen_temp_keyword();
        if check_is_keyword_available(db, &keyword).await? {
            break;
        }
    }

    Ok(keyword)
}

#[derive(Serialize)]
struct PostRoomResp {
    pub room_id: Option<Uuid>,
    pub keyword: Option<String>,
    pub success: bool,
}

async fn post_room_inner(
    auth: AuthUser,
    state: EngineState,
) -> Result<JsonResponse<PostRoomResp>, EngineErr> {
    let keyword = gen_keyword(&state.db).await?;
    let id = generate_room(&state.db, keyword.clone(), auth.user_id).await?;
    Ok((
        axum::http::StatusCode::OK,
        Json(PostRoomResp {
            room_id: Some(id),
            keyword: Some(keyword),
            success: true,
        }),
    ))
}

pub async fn post_room(auth: AuthUser, State(state): State<EngineState>) -> impl IntoResponse {
    match post_room_inner(auth, state).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(PostRoomResp {
                    room_id: None,
                    keyword: None,
                    success: false,
                }),
            )
        }
    }
}

#[derive(Deserialize)]
pub struct GetRoomQuery {
    pub keyword: String,
}

#[derive(Serialize)]
pub struct GetRoomResult {
    pub room_id: Option<Uuid>,
    pub how_many: usize,
    pub success: bool,
    pub as_master: bool,
}

async fn get_room_inner(
    auth: AuthUser,
    q: GetRoomQuery,
    state: EngineState,
) -> Result<(axum::http::StatusCode, Json<GetRoomResult>), EngineErr> {
    Ok(
        if let Some(room_id) = get_room_id_from_keyword(&state.db, &q.keyword).await? {
            let as_master = check_if_he_is_authorized(&state.db, auth.user_id, room_id).await?;
            (
                axum::http::StatusCode::OK,
                Json(GetRoomResult {
                    room_id: Some(room_id),
                    success: true,
                    how_many: state
                        .manager
                        .rooms
                        .get(&room_id)
                        .map(|r| r.len())
                        .unwrap_or(0),
                    as_master,
                }),
            )
        } else {
            tracing::info!("get room inner: Bad Request");
            (
                axum::http::StatusCode::BAD_REQUEST,
                Json(GetRoomResult {
                    room_id: None,
                    how_many: 0,
                    success: false,
                    as_master: false,
                }),
            )
        },
    )
}

pub async fn get_room(
    auth: AuthUser,
    Query(q): Query<GetRoomQuery>,
    State(state): State<EngineState>,
) -> impl IntoResponse {
    match get_room_inner(auth, q, state).await {
        Ok(res) => res,
        Err(e) => {
            tracing::error!("{e}");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(GetRoomResult {
                    room_id: None,
                    how_many: 0,
                    success: false,
                    as_master: false,
                }),
            )
        }
    }
}

#[derive(Deserialize)]
pub struct DeleteRoomQuery {
    pub room_id: Uuid,
}

pub async fn delete_room(
    Query(q): Query<DeleteRoomQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match delete_room_inner(q, state, auth).await {
        Ok(res) => res,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn delete_room_inner(
    q: DeleteRoomQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<axum::http::StatusCode, EngineErr> {
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };
    if let AccessControl::Denied(status) = user.can_delete_room(&state).await? {
        return Ok(status);
    }

    repository::delete_room(&state.db, q.room_id).await?;
    broadcast(
        &state.manager,
        q.room_id,
        crate::ws::ServerEvent::RoomDeleted,
    );

    Ok(axum::http::StatusCode::OK)
}
