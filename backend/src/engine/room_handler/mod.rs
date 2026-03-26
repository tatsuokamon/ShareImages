use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use base64::{Engine, prelude::BASE64_STANDARD};
use rand::Rng;
use redis::FromRedisValue;
use sea_orm::{ConnectionTrait, DatabaseConnection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    engine::{EngineErr, EngineState, JsonResponse, auth::AuthUser, right_control::User},
    repository::{self, check_is_keyword_available, generate_room, get_room_id_from_keyword},
    ws::broadcast,
};

fn gen_temp_keyword() -> String {
    let mut bytes = [0u8; 12];
    rand::rng().fill_bytes(&mut bytes);
    String::from_utf8(BASE64_STANDARD.decode(bytes).unwrap()).unwrap()
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
    pub user_id: Uuid,
    pub keyword: String,
}

#[derive(Serialize)]
pub struct GetRoomResult {
    pub room_id: Option<Uuid>,
    pub how_many: usize,
    pub success: bool,
}

async fn get_room_inner(
    q: GetRoomQuery,
    state: EngineState,
) -> Result<(axum::http::StatusCode, Json<GetRoomResult>), EngineErr> {
    Ok(
        if let Some(room_id) = get_room_id_from_keyword(&state.db, &q.keyword).await? {
            (
                axum::http::StatusCode::OK,
                Json(GetRoomResult {
                    room_id: Some(room_id),
                    success: true,
                    how_many: state.manager.rooms.get(&room_id).unwrap().len(),
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

pub async fn get_room(
    Query(q): Query<GetRoomQuery>,
    State(state): State<EngineState>,
) -> impl IntoResponse {
    match get_room_inner(q, state).await {
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
    if !user.can_delete_room(&state).await? {
        return Ok(axum::http::StatusCode::FORBIDDEN);
    }

    repository::delete_room(&state.db, &q.room_id).await?;
    broadcast(
        &state.manager,
        q.room_id,
        crate::ws::ServerEvent::RoomDeleted,
    );

    Ok(axum::http::StatusCode::OK)
}
