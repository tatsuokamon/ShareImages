use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QuerySelect,
    RelationTrait,
};
use uuid::Uuid;

use crate::{
    entity::{image_vote, images, room},
    repository::RepositoryErr,
};

pub async fn check_if_img_vote_exists(
    db: &impl ConnectionTrait,
    user_id: Uuid,
    img_id: Uuid,
) -> Result<Option<image_vote::Model>, RepositoryErr> {
    Ok(image_vote::Entity::find()
        .join(
            sea_orm::JoinType::InnerJoin,
            image_vote::Relation::Images.def().rev(),
        )
        .filter(images::Column::DeletedAt.is_null())
        .filter(image_vote::Column::UserId.eq(user_id))
        .filter(image_vote::Column::ImageId.eq(img_id))
        .one(db)
        .await?)
}

pub async fn upsert_img_vote(
    db: &impl ConnectionTrait,
    model: Option<image_vote::Model>,
    user_id: Uuid,
    img_id: Uuid,
    is_good: bool,
) -> Result<(), RepositoryErr> {
    match model {
        None => {
            image_vote::ActiveModel {
                image_id: sea_orm::ActiveValue::Set(img_id),
                is_good: sea_orm::ActiveValue::Set(is_good),
                created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
                user_id: sea_orm::ActiveValue::Set(user_id),
            }
            .insert(db)
            .await?;
        }
        Some(m) => {
            let mut active_model: image_vote::ActiveModel = m.into();
            active_model.is_good = sea_orm::ActiveValue::Set(is_good);
            active_model.created_at = sea_orm::ActiveValue::Set(chrono::Utc::now());

            active_model.update(db).await?;
        }
    }

    Ok(())
}

pub async fn vote_good(
    db: &impl ConnectionTrait,
    user_id: Uuid,
    img_id: Uuid,
    is_good: bool,
) -> Result<(), RepositoryErr> {
    if let Some(m) = image_vote::Entity::find()
        .filter(image_vote::Column::UserId.eq(user_id))
        .filter(image_vote::Column::ImageId.eq(img_id))
        .one(db)
        .await?
    {
        let mut active_model: image_vote::ActiveModel = m.into();
        active_model.is_good = sea_orm::ActiveValue::Set(is_good);

        active_model.update(db).await?;
    } else {
        image_vote::ActiveModel {
            image_id: sea_orm::ActiveValue::Set(img_id),
            user_id: sea_orm::ActiveValue::Set(user_id),
            created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
            is_good: sea_orm::ActiveValue::Set(is_good),
        }
        .insert(db)
        .await?;
    }

    Ok(())
}
