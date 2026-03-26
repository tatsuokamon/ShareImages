use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use chrono::NaiveDateTime;
use redis::AsyncCommands;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QuerySelect,
    RelationTrait,
};
use uuid::Uuid;

use crate::{entity::room, repository::RepositoryErr};

pub async fn check_if_room_exists(
    db: &impl ConnectionTrait,
    room_id: &Uuid,
) -> Result<bool, RepositoryErr> {
    Ok(room::Entity::find()
        .filter(room::Column::Id.eq(room_id.to_string()))
        .one(db)
        .await?
        .is_some())
}

pub async fn check_is_keyword_available(
    db: &impl ConnectionTrait,
    keyword: &str,
) -> Result<bool, RepositoryErr> {
    Ok(room::Entity::find()
        .filter(room::Column::Keyword.eq(keyword))
        .one(db)
        .await?
        .is_some())
}

pub async fn generate_room(
    db: &impl ConnectionTrait,
    keyword: String,
    master_id: Uuid,
) -> Result<Uuid, RepositoryErr> {
    Ok(room::ActiveModel {
        keyword: sea_orm::ActiveValue::Set(keyword),
        master_id: sea_orm::ActiveValue::Set(master_id),
        created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
        deleted_at: sea_orm::ActiveValue::Set(None as Option<chrono::DateTime<chrono::Utc>>),
        ..Default::default()
    }
    .insert(db)
    .await?
    .id)
}

pub async fn get_room_id_from_keyword(
    db: &impl ConnectionTrait,
    keyword: &str,
) -> Result<Option<Uuid>, RepositoryErr> {
    Ok(
        if let Some(m) = room::Entity::find()
            .filter(room::Column::Keyword.eq(keyword))
            .filter(room::Column::DeletedAt.eq(None as Option<NaiveDateTime>))
            .one(db)
            .await?
        {
            Some(m.id)
        } else {
            None
        },
    )
}

pub async fn delete_room(db: &impl ConnectionTrait, room_id: &Uuid) -> Result<(), RepositoryErr> {
    if let Some(room) = room::Entity::find()
        .filter(room::Column::Id.eq(room_id.to_string()))
        .one(db)
        .await?
    {
        if room.deleted_at.is_none() {
            let mut active_value: room::ActiveModel = room.into();
            active_value.deleted_at = sea_orm::ActiveValue::Set(Some(chrono::Utc::now()));
            active_value.update(db).await?;
        }
    }

    Ok(())
}
