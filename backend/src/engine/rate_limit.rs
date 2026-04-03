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

fn get_ip_without_proxy(req: &Request<axum::body::Body>) -> Result<String, axum::http::StatusCode> {
    if let Some(ConnectInfo(addr)) = req.extensions().get::<ConnectInfo<SocketAddr>>() {
        Ok(addr.ip().to_string())
    } else {
        Err(axum::http::StatusCode::BAD_REQUEST)
    }
}

fn get_ip_with_proxy(req: &Request<axum::body::Body>) -> Result<String, axum::http::StatusCode> {
    if let Some(ip) = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(",").next())
    {
        Ok(ip.trim().to_string())
    } else {
        Err(axum::http::StatusCode::BAD_REQUEST)
    }
}

async fn rate_limit_middleware_base(
    State(state): State<EngineState>,
    req: Request<axum::body::Body>,
    next: Next,
    ip: String,
) -> Result<Response, StatusCode> {
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

pub async fn rate_limit_middleware_with_proxy(
    State(state): State<EngineState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = get_ip_with_proxy(&req)?;
    Ok(rate_limit_middleware_base(State(state), req, next, ip).await?)
}

pub async fn rate_limit_middleware_without_proxy(
    State(state): State<EngineState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = get_ip_without_proxy(&req)?;
    Ok(rate_limit_middleware_base(State(state), req, next, ip).await?)
}
