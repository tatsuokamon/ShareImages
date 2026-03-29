use std::collections::HashMap;

use bb8::PooledConnection;
use bb8_redis::RedisConnectionManager;
use redis::AsyncCommands;
use uuid::Uuid;

use crate::repository::RepositoryErr;

fn room_ban_tag(room_id: &Uuid) -> String {
    format!("room_ban:{}", room_id)
}

fn global_ban_tag() -> String {
    "global_ban".to_string()
}

// if room id not specified, target will be banned from all room
pub async fn ban_user(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    room_id: &Uuid,
    user_identifier: &str,
) -> Result<(), RepositoryErr> {
    Ok(conn
        .hset::<String, &str, &str, _>(room_ban_tag(room_id), user_identifier, "1")
        .await?)
}

// ban user from "all"
// uses the word "all" so that Uuid will never genearate "all"
pub async fn start_ignore_him(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_identifier: &str,
) -> Result<(), RepositoryErr> {
    Ok(conn
        .hset::<String, &str, &str, _>(global_ban_tag(), user_identifier, "1")
        .await?)
}

pub async fn start_recognize_him(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    user_identifier: &str,
) -> Result<(), RepositoryErr> {
    Ok(conn
        .hdel::<String, &str, _>(global_ban_tag(), user_identifier)
        .await?)
}

pub async fn resolve_ban(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    room_id: &Uuid,
    user_identifier: &str,
) -> Result<(), RepositoryErr> {
    Ok(conn
        .hdel::<String, &str, _>(room_ban_tag(room_id), user_identifier)
        .await?)
}

pub async fn check_if_he_is_banned(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    room_id: &Uuid,
    user_identifier: &str,
) -> Result<bool, RepositoryErr> {
    Ok(conn
        .hget::<String, &str, Option<String>>(global_ban_tag(), user_identifier)
        .await?
        .is_some()
        || conn
            .hget::<String, &str, Option<String>>(room_ban_tag(room_id), user_identifier)
            .await?
            .is_some())
}

pub async fn get_all_banned_users(
    conn: &mut PooledConnection<'_, RedisConnectionManager>,
    room_id: Uuid,
) -> Result<Option<Vec<String>>, RepositoryErr> {
    Ok(Some(
        if let Some(v) = conn
            .hgetall::<String, Option<HashMap<String, String>>>(room_ban_tag(&room_id))
            .await?
        {
            v.into_keys().collect()
        } else {
            vec![]
        },
    ))
}
