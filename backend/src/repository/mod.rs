use aws_sdk_s3::{
    error::SdkError, operation::put_object::PutObjectError, presigning::PresigningConfigError,
};
use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use chrono::{DateTime, Utc};
use redis::{AsyncCommands, RedisError};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DbErr, EntityTrait, QueryFilter, QuerySelect,
    RelationTrait,
};
use sha2::Digest;
use std::{collections::HashMap, time::Duration};
use uuid::Uuid;

use crate::entity::{comment, image_vote, images, room, user};

pub use about_ban::{
    ban_user, check_if_he_is_banned, get_all_banned_users, resolve_ban, start_ignore_him,
    start_recognize_him,
};

pub use about_image::{
    add_presigned_url_key, check_if_his_img_waits_enough, check_if_img_deleted,
    check_if_img_exists, commit_img, delete_img, generate_object_key, generate_presigned_url,
    get_object_key, get_posted_imgs, is_the_owner_of_image, update_commit_img_status,
};

pub use about_room::{
    check_if_room_exists, check_is_keyword_available, delete_room, generate_room,
    get_room_id_from_keyword,
};

pub use about_comment::{
    check_if_comment_exists, check_if_his_comment_waits_enough, delete_comment,
    get_posted_comments, is_the_owner_of_comment, post_comment, update_post_comment_status,
};

pub use about_img_vote::{check_if_img_vote_exists, upsert_img_vote, vote_good};

mod about_ban;
mod about_comment;
mod about_image;
mod about_img_vote;
mod about_room;

#[derive(Debug, thiserror::Error)]
pub enum RepositoryErr {
    #[error("RepositoryErr: DBErr: {0}")]
    DBErr(#[from] DbErr),

    #[error("RepositoryErr: SDKError: {0}")]
    SDKError(#[from] SdkError<PutObjectError>),

    #[error("RepositoryErr: PresigningConfigErr: {0}")]
    PresigningConfigErr(#[from] PresigningConfigError),

    #[error("RepositoryErr: RedisError: {0}")]
    RedisError(#[from] RedisError),
}

pub async fn check_if_he_exists(
    db: &impl ConnectionTrait,
    user_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(user::Entity::find()
        .filter(user::Column::Id.eq(user_id.to_string()))
        .one(db)
        .await?
        .is_some())
}

pub async fn check_if_he_is_authorized(
    db: &impl ConnectionTrait,
    user_id: &Uuid,
    room_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(
        if let Some(m) = room::Entity::find()
            .filter(room::Column::Id.eq(room_id.to_string()))
            .filter(room::Column::DeletedAt.eq(None as Option<DateTime<Utc>>))
            .one(db)
            .await?
        {
            m.master_id == *user_id
        } else {
            false
        },
    )
}

pub async fn generate_user(db: &impl ConnectionTrait) -> Result<Uuid, RepositoryErr> {
    Ok(user::ActiveModel {
        created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
        ..Default::default()
    }
    .insert(db)
    .await?
    .id)
}

pub async fn find_user_id_with_img_id(
    db: &impl ConnectionTrait,
    img_id: &Uuid,
) -> Result<Option<Uuid>, RepositoryErr> {
    Ok(
        if let Some(m) = user::Entity::find()
            .join(
                sea_orm::JoinType::InnerJoin,
                user::Relation::Images.def().rev(),
            )
            .filter(images::Column::Id.eq(img_id.to_string()))
            .one(db)
            .await?
        {
            Some(m.id)
        } else {
            None
        },
    )
}

pub async fn check_if_room_has_img(
    db: &impl ConnectionTrait,
    img_id: &Uuid,
    room_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    if let Some(m) = images::Entity::find()
        .filter(images::Column::Id.eq(img_id.to_string()))
        .one(db)
        .await?
    {
        return Ok(m.room_id == *room_id);
    };

    Ok(false)
}

pub async fn check_if_room_has_comment(
    db: &impl ConnectionTrait,
    comment_id: &Uuid,
    room_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    if let Some(m) = comment::Entity::find()
        .filter(comment::Column::Id.eq(comment_id.to_string()))
        .one(db)
        .await?
    {
        return Ok(m.room_id == *room_id);
    };

    Ok(false)
}
