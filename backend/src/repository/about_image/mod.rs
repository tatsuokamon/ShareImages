use std::time::Duration;

use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QuerySelect,
    RelationTrait,
};
use sha2::Digest;
use uuid::Uuid;

use crate::{
    entity::{images, room},
    repository::RepositoryErr,
};

fn generate_redis_post_img_tag(user_id: &Uuid) -> String {
    format!("post-img-{}", user_id)
}

fn generate_redis_key_save(key: &str, user_id: &Uuid) -> String {
    format!("presigned:{user_id}:{key}")
}

pub fn generate_object_key(room_id: &Uuid) -> String {
    format!("{}/{}", room_id, Uuid::new_v4().to_string())
}

pub async fn get_object_key(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
    key: &str,
) -> Result<Option<String>, RepositoryErr> {
    let redis_presigned_tag = generate_redis_key_save(key, user_id);
    Ok(conn
        .get::<String, Option<String>>(redis_presigned_tag)
        .await?)
}

pub async fn check_if_img_exists(
    db: &impl ConnectionTrait,
    img_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(images::Entity::find()
        .filter(images::Column::Id.eq(img_id.to_string()))
        .one(db)
        .await?
        .is_some())
}

pub async fn add_presigned_url_key(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
    key: &str,
    object_key: &str,
    expires_in: u64,
) -> Result<(), RepositoryErr> {
    let key_tag = generate_redis_key_save(key, user_id);
    let _: String = redis::cmd("SET")
        .arg(key_tag)
        .arg(object_key)
        .arg("NX")
        .arg("EX")
        .arg(expires_in)
        .query_async(&mut **conn)
        .await?;
    Ok(())
}

pub async fn is_the_owner_of_image(
    db: &impl ConnectionTrait,
    img_id: &Uuid,
    user_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(
        if let Some(img) = images::Entity::find()
            .filter(images::Column::DeletedAt.eq(None as Option<DateTime<Utc>>))
            .filter(images::Column::Id.eq(img_id.to_string()))
            .one(db)
            .await?
        {
            img.user_id == *user_id
        } else {
            false
        },
    )
}

pub async fn check_if_img_deleted(
    db: &impl ConnectionTrait,
    img_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(
        if let Some(m) = images::Entity::find()
            .filter(images::Column::Id.eq(img_id.to_string()))
            .one(db)
            .await?
            && m.deleted_at != None
        {
            true
        } else {
            false
        },
    )
}

pub async fn get_posted_imgs(
    db: &impl ConnectionTrait,
    room_id: &Uuid,
) -> Result<Vec<images::Model>, RepositoryErr> {
    Ok(images::Entity::find()
        .join(
            sea_orm::JoinType::InnerJoin,
            images::Relation::Room.def().rev(),
        )
        .filter(room::Column::Id.eq(room_id.to_string()))
        .filter(images::Column::DeletedAt.eq(None as Option<DateTime<Utc>>))
        .all(db)
        .await?)
}

pub async fn commit_img(
    db: &impl ConnectionTrait,

    room_id: Uuid,
    user_id: Uuid,
    title: Option<String>,
    object_key: String,
) -> Result<Uuid, RepositoryErr> {
    Ok(images::ActiveModel {
        title: sea_orm::ActiveValue::Set(title),
        room_id: sea_orm::ActiveValue::Set(room_id),
        created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
        deleted_at: sea_orm::ActiveValue::Set(None as Option<chrono::DateTime<chrono::Utc>>),
        user_id: sea_orm::ActiveValue::Set(user_id),
        object_key: sea_orm::ActiveValue::Set(object_key),
        score: sea_orm::ActiveValue::Set(0),
        ..Default::default()
    }
    .insert(db)
    .await?
    .id)
}

pub async fn update_commit_img_status(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
    timeout: usize,
) -> Result<(), RepositoryErr> {
    let post_comment_tag = generate_redis_post_img_tag(user_id);

    let _: String = redis::cmd("SET")
        .arg(post_comment_tag)
        .arg("1")
        .arg("NX")
        .arg("EX")
        .arg(timeout)
        .query_async(&mut **conn)
        .await?;

    Ok(())
}

pub async fn check_if_his_img_waits_enough(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    let post_img_tag = generate_redis_post_img_tag(user_id);
    Ok(conn
        .get::<String, Option<String>>(post_img_tag)
        .await?
        .is_none())
}

pub async fn delete_img(db: &impl ConnectionTrait, img_id: Uuid) -> Result<(), RepositoryErr> {
    if let Some(m) = images::Entity::find()
        .filter(images::Column::Id.eq(img_id.to_string()))
        .one(db)
        .await?
    {
        let mut active_model: images::ActiveModel = m.into();
        active_model.deleted_at = sea_orm::ActiveValue::Set(Some(chrono::Utc::now()));

        active_model.update(db).await?;
    }

    Ok(())
}

pub async fn generate_presigned_url(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    object_key: &str,
    expires_in: u64,
) -> Result<String, RepositoryErr> {
    let presigned = client
        .put_object()
        .bucket(bucket)
        .key(object_key)
        .presigned(aws_sdk_s3::presigning::PresigningConfig::expires_in(
            Duration::from_secs(expires_in),
        )?)
        .await?;

    Ok(presigned.uri().to_string())
}
