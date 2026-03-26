use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use regex::Regex;
use sea_orm::{ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter};
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

pub async fn check_if_he_can_take_action(
    db: &impl ConnectionTrait,
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
    room_id: &Uuid,
) -> Result<bool, EngineErr> {
    let user_identifier = generate_user_identifier(user_id);
    Ok(
        if check_if_he_exists(db, user_id).await?
            && check_if_room_exists(db, room_id).await?
            && !check_if_he_is_banned(conn, room_id, &user_identifier).await?
        {
            true
        } else {
            false
        },
    )
}

pub struct User {
    pub user_id: Uuid,
    pub room_id: Uuid,
}

impl User {
    pub async fn can_get_presigned_url(&self, state: &EngineState) -> Result<bool, EngineErr> {
        let mut conn = state.pool.get().await?;
        Ok(
            check_if_he_can_take_action(&state.db, &mut conn, &self.user_id, &self.room_id).await?
                && check_if_his_img_waits_enough(&mut conn, &self.user_id).await?,
        )
    }

    pub async fn can_post_img(&self, state: &EngineState) -> Result<bool, EngineErr> {
        let mut conn = state.pool.get().await?;
        Ok(check_if_he_can_take_action(&state.db, &mut conn, &self.user_id, &self.room_id).await?)
    }

    pub async fn can_post_comment(&self, state: &EngineState) -> Result<bool, EngineErr> {
        let mut conn = state.pool.get().await?;
        Ok(
            check_if_he_can_take_action(&state.db, &mut conn, &self.user_id, &self.room_id).await?
                && check_if_his_comment_waits_enough(&mut conn, &self.user_id).await?,
        )
    }

    pub async fn can_delete_img(
        &self,
        state: &EngineState,
        img_id: Uuid,
    ) -> Result<bool, EngineErr> {
        if !check_if_room_exists(&state.db, &self.room_id).await? {
            return Ok(false);
        }
        // master of room
        if check_if_he_is_authorized(&state.db, &self.user_id, &self.room_id).await?
            && check_if_room_has_img(&state.db, &img_id, &self.room_id).await?
        {
            return Ok(true);
        }

        if is_the_owner_of_image(&state.db, &img_id, &self.user_id).await? {
            return Ok(true);
        }

        return Ok(false);
    }

    pub async fn can_delete_comment(
        &self,
        state: &EngineState,
        comment_id: Uuid,
    ) -> Result<bool, EngineErr> {
        if !check_if_room_exists(&state.db, &self.room_id).await? {
            return Ok(false);
        }
        // master of room
        if check_if_he_is_authorized(&state.db, &self.user_id, &self.room_id).await?
            && check_if_room_has_comment(&state.db, &comment_id, &self.room_id).await?
        {
            return Ok(true);
        }

        if is_the_owner_of_comment(&state.db, &comment_id, &self.user_id).await? {
            return Ok(true);
        }

        return Ok(false);
    }

    pub async fn can_ban_user(&self, state: &EngineState) -> Result<bool, EngineErr> {
        // master of room
        if check_if_he_is_authorized(&state.db, &self.user_id, &self.room_id).await? {
            return Ok(true);
        }

        return Ok(false);
    }

    pub async fn can_delete_room(&self, state: &EngineState) -> Result<bool, EngineErr> {
        if check_if_he_is_authorized(&state.db, &self.user_id, &self.room_id).await? {
            return Ok(true);
        }

        return Ok(false);
    }

    pub async fn can_vote(&self, state: &EngineState, img_id: Uuid) -> Result<bool, EngineErr> {
        let mut conn = state.pool.get().await?;
        Ok(
            check_if_he_can_take_action(&state.db, &mut conn, &self.user_id, &self.room_id).await?
                && check_if_room_has_img(&state.db, &img_id, &self.room_id).await?,
        )
    }
}
