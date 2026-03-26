use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use bb8::RunError;
use redis::RedisError;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use uuid::Uuid;

use crate::{
    engine::{EngineState, auth::AuthUser},
    repository::{
        RepositoryErr, add_presigned_url_key, check_if_his_img_waits_enough, generate_object_key,
        generate_presigned_url,
    },
};

#[derive(Deserialize)]
pub struct GetURLQuery {
    pub room_id: Uuid,
}

#[derive(thiserror::Error, Debug)]
pub enum GetURLErr {
    #[error("PostImgErr: FromRepository: {0}")]
    FromRepository(#[from] RepositoryErr),

    #[error("PostImgErr: FromRedis: {0}")]
    FromRedis(#[from] RunError<RedisError>),
}

#[derive(Serialize)]
pub struct GetURLResult {
    pub presigned_url: Option<String>,
    pub key: Option<String>,
    pub success: bool,
}

pub async fn get_presigned_url(
    Query(q): Query<GetURLQuery>,
    State(state): State<EngineState>,
    auth: AuthUser,
) -> impl IntoResponse {
    match _get_presigned_url_inner(q, state, auth).await {
        Ok(resp) => {
            let (code, result) = resp;
            (code, Json(result))
        }
        Err(e) => {
            tracing::error!("{e}");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(GetURLResult {
                    presigned_url: None,
                    key: None,
                    success: false,
                }),
            )
        }
    }
}

async fn _get_presigned_url_inner(
    q: GetURLQuery,
    state: EngineState,
    auth: AuthUser,
) -> Result<(axum::http::StatusCode, GetURLResult), GetURLErr> {
    let mut conn = state.pool.get().await?;
    if !check_if_he_can_take_action_in_room(&state.db, &mut conn, &auth.user_id, &q.room_id).await?
    {
        return Ok((
            axum::http::StatusCode::FORBIDDEN,
            GetURLResult {
                presigned_url: None,
                key: None,
                success: false,
            },
        ));
    };

    if !check_if_his_img_waits_enough(&mut conn, &auth.user_id).await? {
        return Ok((
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            GetURLResult {
                presigned_url: None,
                key: None,
                success: false,
            },
        ));
    }

    let obj_key = generate_object_key(&q.room_id);
    let presigned_url = generate_presigned_url(
        &state.sdk_client,
        &state.bucket_name,
        &obj_key,
        state.expires_in,
    )
    .await?;

    let key = gen_presigned_url_key(&presigned_url);
    add_presigned_url_key(&mut conn, &auth.user_id, &key, &obj_key, state.expires_in).await?;

    Ok((
        axum::http::StatusCode::OK,
        GetURLResult {
            presigned_url: Some(presigned_url),
            key: Some(key),
            success: true,
        },
    ))
}

fn gen_presigned_url_key(presigned_url: &str) -> String {
    format!("{:x}", sha2::Sha256::digest(presigned_url.as_bytes()))
}
