########################################
# 1. frontend build (vite)
########################################
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

RUN npx tsc


########################################
# 2. migration build
########################################
FROM rust:1.93-bookworm AS migration-builder

WORKDIR /app

COPY backend/migration/src ./src
COPY backend/migration/Cargo.toml backend/migration/Cargo.lock ./

RUN cargo build --release


########################################
# 3. backend build
########################################
FROM rust:1.93-bookworm AS backend-builder

WORKDIR /app

COPY backend/Cargo.toml backend/Cargo.lock ./

RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo build --release
RUN rm -r src

COPY backend/ ./

RUN cargo build --release


########################################
# 4. runtime image (distroless)
########################################
FROM gcr.io/distroless/cc-debian12

WORKDIR /app

#########################
# backend binary
#########################

COPY --from=backend-builder \
    /app/target/release/backend \
    ./backend

#########################
# migration binary
#########################

COPY --from=migration-builder \
    /app/target/release/migration \
    ./migration

#########################
# frontend static files
#########################

COPY --from=frontend-builder \
    /frontend/public \
    ./public

#########################

EXPOSE 80
