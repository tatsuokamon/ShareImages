use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::engine::EngineState;

fn generate_rate_limit_tag(ip: &String) -> String {
    tracing::error!("called generate_rate_limit_tag");
    format!("rate-limit:ip:{}", ip)
}

pub async fn rate_limit_middleware(
    State(state): State<EngineState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = if let Some(ConnectInfo(addr)) = req.extensions().get::<ConnectInfo<SocketAddr>>() {
        addr.ip().to_string()
    } else {
        tracing::error!("here!");
        return Err(StatusCode::BAD_REQUEST);
    };

    let key = generate_rate_limit_tag(&ip);
    let mut conn = state.pool.get().await.map_err(|_| {
        tracing::error!("err 2");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let count: usize = redis::cmd("INCR")
        .arg(&key)
        .query_async(&mut *conn)
        .await
        .map_err(|_| {
            tracing::error!("err 3");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if count == 1 {
        let _: () = redis::cmd("EXPIRE")
            .arg(&key)
            .arg(60)
            .query_async(&mut *conn)
            .await
            .map_err(|_| {
                tracing::error!("err 4");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }

    if count > state.req_per_minute {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(req).await)
}
