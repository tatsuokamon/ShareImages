use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use uuid::Uuid;

use crate::{
    engine::{
        EngineErr, EngineState, JsonResponse,
        auth::AuthUser,
        generate_user_identifier,
        right_control::{AccessControl, User},
    },
    repository::{
        self, add_presigned_url_key, commit_img, generate_object_key, generate_presigned_url,
        get_object_key, update_commit_img_status,
    },
    ws::{ServerEvent, broadcast},
};

#[derive(Deserialize)]
pub struct GetURLQuery {
    pub room_id: Uuid,
    pub content_type: String,
}

#[derive(Serialize)]
pub struct GetURLResp {
    pub presigned_url: Option<String>,
    pub key: Option<String>,
    pub success: bool,
}

fn gen_presigned_url_key(presigned_url: &str) -> String {
    format!("{:x}", sha2::Sha256::digest(presigned_url.as_bytes()))
}

async fn get_presigned_url_inner(
    q: GetURLQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<JsonResponse<GetURLResp>, EngineErr> {
    let mut conn = state.pool.get().await?;
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if let AccessControl::Denied(status) =
        user.can_get_presigned_url(&q.content_type, &state).await?
    {
        return Ok((
            status,
            Json(GetURLResp {
                presigned_url: None,
                key: None,
                success: false,
            }),
        ));
    }

    let obj_key = generate_object_key(q.room_id);
    let presigned_url = generate_presigned_url(
        &state.sdk_client,
        &state.bucket_name,
        &obj_key,
        state.expires_in,
        &q.content_type,
    )
    .await?;

    let key = gen_presigned_url_key(&presigned_url);
    add_presigned_url_key(&mut conn, auth.user_id, &key, &obj_key, state.expires_in).await?;

    Ok((
        axum::http::StatusCode::OK,
        Json(GetURLResp {
            presigned_url: Some(presigned_url),
            key: Some(key),
            success: true,
        }),
    ))
}

pub async fn get_presigned_url(
    Query(q): Query<GetURLQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match get_presigned_url_inner(q, state, auth).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(GetURLResp {
                    presigned_url: None,
                    key: None,
                    success: false,
                }),
            )
        }
    }
}

#[derive(Deserialize)]
pub struct PostImgQuery {
    pub room_id: Uuid,
}

#[derive(Deserialize)]
pub struct PostImgPayload {
    pub display_name: Option<String>,
    pub title: Option<String>,
    pub key: String,
}

async fn post_img_inner(
    q: PostImgQuery,
    state: EngineState,
    auth: AuthUser,
    payload: PostImgPayload,
) -> Result<axum::http::StatusCode, EngineErr> {
    let user = User {
        user_id: auth.user_id,
        room_id: q.room_id,
    };

    if let AccessControl::Denied(status) = user.can_post_img(&state).await? {
        return Ok(status);
    };

    let mut conn = state.pool.get().await?;
    let obj_key = get_object_key(&mut conn, auth.user_id, &payload.key).await?;
    if obj_key.is_none() {
        return Ok(axum::http::StatusCode::BAD_REQUEST);
    }

    let object_key = obj_key.unwrap();
    let identifier = generate_user_identifier(user.user_id);
    let img_id = commit_img(
        &state.db,
        q.room_id,
        auth.user_id,
        identifier.clone(),
        payload.display_name.clone(),
        payload.title.clone(),
        object_key.clone(),
    )
    .await?;

    update_commit_img_status(&mut conn, auth.user_id, state.post_img_timeout).await?;

    broadcast(
        &state.manager,
        q.room_id,
        ServerEvent::ImagePosted {
            id: img_id,
            title: payload.title,
            score: 0,
            display_name: payload.display_name,
            user_identifier: identifier,
            object_key: object_key,
            created_at: chrono::Utc::now().timestamp(),
        },
    );

    Ok(axum::http::StatusCode::OK)
}

pub async fn post_img(
    Query(q): Query<PostImgQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
    Json(payload): Json<PostImgPayload>,
) -> impl IntoResponse {
    match post_img_inner(q, state, auth, payload).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

#[derive(Deserialize)]
pub struct DeleteImgQuery {
    pub img_id: Uuid,
    pub room_id: Uuid,
}

async fn delete_img_inner(
    q: DeleteImgQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<axum::http::StatusCode, EngineErr> {
    let user = User {
        room_id: q.room_id,
        user_id: auth.user_id,
    };

    if let AccessControl::Denied(status) = user.can_delete_img(&state, q.img_id).await? {
        return Ok(status);
    }

    repository::delete_img(&state.db, q.img_id).await?;
    broadcast(
        &state.manager,
        q.room_id,
        ServerEvent::ImageDeleted { id: q.img_id },
    );

    Ok(axum::http::StatusCode::OK)
}

pub async fn delete_img(
    Query(q): Query<DeleteImgQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match delete_img_inner(q, state, auth).await {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!("{e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}
