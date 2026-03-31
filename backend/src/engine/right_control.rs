use axum::http::StatusCode;
use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use sea_orm::ConnectionTrait;
use uuid::Uuid;

use crate::{
    engine::{EngineErr, EngineState, generate_user_identifier},
    repository::{
        check_if_he_exists, check_if_he_is_authorized, check_if_he_is_banned,
        check_if_his_comment_waits_enough, check_if_his_img_waits_enough, check_if_room_exists,
        check_if_room_has_comment, check_if_room_has_img, is_the_owner_of_comment,
        is_the_owner_of_image,
    },
};

const ALLOWED_CONTENT_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
];

pub enum AccessControl {
    Allowed,
    Denied(StatusCode),
}

pub async fn check_if_he_can_take_action(
    db: &impl ConnectionTrait,
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: Uuid,
    room_id: Uuid,
) -> Result<AccessControl, EngineErr> {
    let user_identifier = generate_user_identifier(user_id);

    if !check_if_he_exists(db, user_id).await? {
        return Ok(AccessControl::Denied(StatusCode::NOT_FOUND));
    }
    if !check_if_room_exists(db, room_id).await? {
        return Ok(AccessControl::Denied(StatusCode::NOT_FOUND));
    }
    if check_if_he_is_banned(conn, room_id, &user_identifier).await? {
        return Ok(AccessControl::Denied(StatusCode::FORBIDDEN));
    }

    Ok(AccessControl::Allowed)
}

pub struct User {
    pub user_id: Uuid,
    pub room_id: Uuid,
}

impl User {
    pub async fn can_get_presigned_url(
        &self,
        content_type: &str,
        state: &EngineState,
    ) -> Result<AccessControl, EngineErr> {
        if !ALLOWED_CONTENT_TYPES.contains(&content_type) {
            return Ok(AccessControl::Denied(StatusCode::UNSUPPORTED_MEDIA_TYPE));
        }

        let mut conn = state.pool.get().await?;
        if let AccessControl::Denied(s) =
            check_if_he_can_take_action(&state.db, &mut conn, self.user_id, self.room_id).await?
        {
            return Ok(AccessControl::Denied(s));
        }
        if !check_if_his_img_waits_enough(&mut conn, self.user_id).await? {
            return Ok(AccessControl::Denied(StatusCode::TOO_MANY_REQUESTS));
        }

        Ok(AccessControl::Allowed)
    }

    pub async fn can_post_img(&self, state: &EngineState) -> Result<AccessControl, EngineErr> {
        let mut conn = state.pool.get().await?;
        check_if_he_can_take_action(&state.db, &mut conn, self.user_id, self.room_id).await
    }

    pub async fn can_post_comment(
        &self,
        state: &EngineState,
    ) -> Result<AccessControl, EngineErr> {
        let mut conn = state.pool.get().await?;
        if let AccessControl::Denied(s) =
            check_if_he_can_take_action(&state.db, &mut conn, self.user_id, self.room_id).await?
        {
            return Ok(AccessControl::Denied(s));
        }
        if !check_if_his_comment_waits_enough(&mut conn, self.user_id).await? {
            return Ok(AccessControl::Denied(StatusCode::TOO_MANY_REQUESTS));
        }

        Ok(AccessControl::Allowed)
    }

    pub async fn can_delete_img(
        &self,
        state: &EngineState,
        img_id: Uuid,
    ) -> Result<AccessControl, EngineErr> {
        if !check_if_room_exists(&state.db, self.room_id).await? {
            return Ok(AccessControl::Denied(StatusCode::NOT_FOUND));
        }
        // master of room
        if check_if_he_is_authorized(&state.db, self.user_id, self.room_id).await?
            && check_if_room_has_img(&state.db, img_id, self.room_id).await?
        {
            return Ok(AccessControl::Allowed);
        }
        if is_the_owner_of_image(&state.db, img_id, self.user_id).await? {
            return Ok(AccessControl::Allowed);
        }

        Ok(AccessControl::Denied(StatusCode::FORBIDDEN))
    }

    pub async fn can_delete_comment(
        &self,
        state: &EngineState,
        comment_id: Uuid,
    ) -> Result<AccessControl, EngineErr> {
        if !check_if_room_exists(&state.db, self.room_id).await? {
            return Ok(AccessControl::Denied(StatusCode::NOT_FOUND));
        }
        // master of room
        if check_if_he_is_authorized(&state.db, self.user_id, self.room_id).await?
            && check_if_room_has_comment(&state.db, comment_id, self.room_id).await?
        {
            return Ok(AccessControl::Allowed);
        }
        if is_the_owner_of_comment(&state.db, comment_id, self.user_id).await? {
            return Ok(AccessControl::Allowed);
        }

        Ok(AccessControl::Denied(StatusCode::FORBIDDEN))
    }

    pub async fn can_ban_user(&self, state: &EngineState) -> Result<AccessControl, EngineErr> {
        if check_if_he_is_authorized(&state.db, self.user_id, self.room_id).await? {
            return Ok(AccessControl::Allowed);
        }

        Ok(AccessControl::Denied(StatusCode::FORBIDDEN))
    }

    pub async fn can_delete_room(&self, state: &EngineState) -> Result<AccessControl, EngineErr> {
        if check_if_he_is_authorized(&state.db, self.user_id, self.room_id).await? {
            return Ok(AccessControl::Allowed);
        }

        Ok(AccessControl::Denied(StatusCode::FORBIDDEN))
    }

    pub async fn can_vote(
        &self,
        state: &EngineState,
        img_id: Uuid,
    ) -> Result<AccessControl, EngineErr> {
        let mut conn = state.pool.get().await?;
        if let AccessControl::Denied(s) =
            check_if_he_can_take_action(&state.db, &mut conn, self.user_id, self.room_id).await?
        {
            return Ok(AccessControl::Denied(s));
        }
        if !check_if_room_has_img(&state.db, img_id, self.room_id).await? {
            return Ok(AccessControl::Denied(StatusCode::NOT_FOUND));
        }

        Ok(AccessControl::Allowed)
    }
}
