use std::{net::SocketAddr, sync::Arc, time::Duration};

use aws_config::{Region, meta::region::RegionProviderChain};
use bb8::Pool;
use bb8_redis::RedisConnectionManager;
use sea_orm::Database;

use crate::{
    engine::{EngineStateSrc, generate_router},
    ws::WsManager,
};

mod engine;
mod entity;
mod repository;
mod ws;

macro_rules! get_env {
    ($keyword:expr) => {{
        tracing::info!("config: {}", $keyword);
        std::env::var(&$keyword).expect(&format!("faied while loading env var: {}", $keyword))
    }};
}

macro_rules! get_env_with_parsing {
    ($keyword:expr, $to:ty) => {{
        tracing::info!("config: {}", $keyword);
        std::env::var(&$keyword)
            .expect(&format!("faied while loading env var: {}", $keyword))
            .parse::<$to>()
            .expect(&format!("failed while parsing env var: {}", $keyword))
    }};
}

#[tokio::main]
async fn main() {
    dotenv::dotenv().expect("failed to load .env");

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // ready state
    let db = Database::connect(get_env!("DATABASE_URL"))
        .await
        .expect("failed to connect db");
    let region_provider = RegionProviderChain::first_try(Region::new("auto"));
    let config = aws_config::from_env()
        .region(region_provider)
        .endpoint_url(get_env!("ENDPOINT_URL"))
        .load()
        .await;
    let s3_config = aws_sdk_s3::config::Builder::from(&config)
        .force_path_style(true)
        .build();
    let sdk_client = aws_sdk_s3::Client::from_conf(s3_config);

    let redis_manager =
        RedisConnectionManager::new(get_env!("REDIS_URL")).expect("failed to connect redis server");

    let pool = Pool::builder()
        .max_size(get_env_with_parsing!("REDIS_POOL_SIZE", u32))
        .connection_timeout(Duration::from_secs(get_env_with_parsing!(
            "REDIS_CONNECTION_TIMEOUT",
            u64
        )))
        .build(redis_manager)
        .await
        .expect("failed to create redis pool");

    let state = Arc::new(EngineStateSrc {
        db,
        sdk_client,
        pool,
        manager: WsManager::new(),
        bucket_name: get_env!("BUCKET_NAME"),

        expires_in: get_env_with_parsing!("EXPIRES_IN", u64),
        post_img_timeout: get_env_with_parsing!("POST_IMG_TIMEOUT", usize),
        post_comment_timeout: get_env_with_parsing!("POST_COMMENT_TIMEOUT", usize),
        secret: get_env!("SECRET").as_bytes().to_vec(),
        req_per_minute: get_env_with_parsing!("REQUEST_PER_MINUTE", usize),
    });

    let router = generate_router(state, &get_env!("PUBLIC_PATH"));
    let listener = tokio::net::TcpListener::bind(get_env!("EXPOSED_URL"))
        .await
        .expect("failed to bind TcpListener");

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("failed to serve");
}
