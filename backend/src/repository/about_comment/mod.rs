use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QuerySelect,
    RelationTrait,
};
use uuid::Uuid;

use crate::{
    entity::{comment, images, room},
    repository::RepositoryErr,
};

fn generate_redis_post_comment_tag(user_id: &Uuid) -> String {
    format!("post-comment-{}", user_id)
}

pub async fn check_if_comment_exists(
    db: &impl ConnectionTrait,
    comment_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(comment::Entity::find()
        .filter(comment::Column::Id.eq(comment_id.to_string()))
        .one(db)
        .await?
        .is_some())
}

pub async fn is_the_owner_of_comment(
    db: &impl ConnectionTrait,
    comment_id: &Uuid,
    user_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(
        if let Some(comm) = comment::Entity::find()
            .filter(comment::Column::DeletedAt.eq(None as Option<DateTime<Utc>>))
            .filter(comment::Column::Id.eq(comment_id.to_string()))
            .one(db)
            .await?
        {
            comm.user_id == *user_id
        } else {
            false
        },
    )
}

pub async fn get_posted_comments(
    db: &impl ConnectionTrait,
    room_id: &Uuid,
) -> Result<Vec<comment::Model>, RepositoryErr> {
    Ok(comment::Entity::find()
        .join(
            sea_orm::JoinType::InnerJoin,
            comment::Relation::Room.def().rev(),
        )
        .filter(room::Column::Id.eq(room_id.to_string()))
        .filter(comment::Column::DeletedAt.eq(None as Option<DateTime<Utc>>))
        .all(db)
        .await?)
}

pub async fn check_if_his_comment_waits_enough(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    let post_comment_tag = generate_redis_post_comment_tag(user_id);
    Ok(conn
        .get::<String, Option<String>>(post_comment_tag)
        .await?
        .is_none())
}

pub async fn post_comment(
    db: &impl ConnectionTrait,

    room_id: Uuid,
    user_id: Uuid,
    display_name: Option<String>,
    content: String,
) -> Result<Uuid, RepositoryErr> {
    Ok(comment::ActiveModel {
        room_id: sea_orm::ActiveValue::Set(room_id),
        user_id: sea_orm::ActiveValue::Set(user_id),
        content: sea_orm::ActiveValue::Set(content),
        display_name: sea_orm::ActiveValue::Set(display_name),
        created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
        deleted_at: sea_orm::ActiveValue::Set(None as Option<chrono::DateTime<chrono::Utc>>),
        ..Default::default()
    }
    .insert(db)
    .await?
    .id)
}

pub async fn update_post_comment_status(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_id: &Uuid,
    timeout: usize,
) -> Result<(), RepositoryErr> {
    let post_comment_tag = generate_redis_post_comment_tag(user_id);

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

pub async fn delete_comment(
    db: &impl ConnectionTrait,
    comment_id: &Uuid,
) -> Result<(), RepositoryErr> {
    if let Some(m) = comment::Entity::find()
        .filter(comment::Column::Id.eq(comment_id.to_string()))
        .one(db)
        .await?
    {
        let mut active_model: comment::ActiveModel = m.into();
        active_model.deleted_at = sea_orm::ActiveValue::Set(Some(chrono::Utc::now()));

        active_model.update(db).await?;
    }

    Ok(())
}
