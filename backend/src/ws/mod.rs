use axum::extract::ws::WebSocket;
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
pub enum ServerEvent {
    ImagePosted {
        id: Uuid,
        title: Option<String>,
        score: i32,
        display_name: Option<String>,
        user_identifier: String,
        object_key: String,
        created_at: i64,
    },

    ImageDeleted {
        id: Uuid,
    },

    CommentPosted {
        id: Uuid,
        display_name: Option<String>,
        content: String,
        user_identifier: String,
        created_at: i64,
    },

    CommentDeleted {
        id: Uuid,
    },

    VotedUpdated {
        image_id: Uuid,
        is_good: bool,
        is_new: bool,
        changed: bool,
    },

    UserBanned {
        his_identifier: String,
    },

    ResolvedUserBan {
        his_identifier: String,
    },

    RoomDeleted,

    OthersJoin {
        user_identifier: String,
    },
    OthersDrop {
        user_identifier: String,
    },
}

type Tx = mpsc::UnboundedSender<ServerEvent>;

#[derive(Default)]
pub struct WsManager {
    pub rooms: DashMap<Uuid, DashMap<String, Tx>>,
}

impl WsManager {
    pub fn new() -> Self {
        WsManager::default()
    }
}

pub fn join_room(manager: &WsManager, room_id: Uuid, user_identifier: String, tx: Tx) {
    manager
        .rooms
        .entry(room_id)
        .or_insert(DashMap::new())
        .insert(user_identifier, tx);
}

pub fn leave_room(manager: &WsManager, room_id: Uuid, user_identifier: String) {
    if let Some(room) = manager.rooms.get(&room_id) {
        room.remove(&user_identifier);

        if room.is_empty() {
            manager.rooms.remove(&room_id);
        }
    }

    broadcast(
        manager,
        room_id,
        ServerEvent::OthersDrop {
            user_identifier: user_identifier,
        },
    );
}

pub fn broadcast(manager: &WsManager, room_id: Uuid, event: ServerEvent) {
    let mut to_remove = vec![];
    if let Some(room) = manager.rooms.get(&room_id) {
        for entry in room.iter() {
            if let Err(e) = entry.value().send(event.clone()) {
                tracing::error!("{e}");
                to_remove.push(entry.key().clone())
            };
        }
        for id in to_remove {
            leave_room(manager, room_id, id.clone());
        }
    }
}

pub async fn handle_socket(
    socket: WebSocket,
    room_id: Uuid,
    user_identifier: String,
    manager: &WsManager,
) {
    let (tx, mut rx) = mpsc::unbounded_channel();
    join_room(manager, room_id, user_identifier.clone(), tx);
    let (mut sender, mut receiver) = socket.split();

    broadcast(
        manager,
        room_id,
        ServerEvent::OthersJoin {
            user_identifier: user_identifier.clone(),
        },
    );
    let send_task = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let json;
            match serde_json::to_string(&event) {
                Ok(ok) => {
                    json = ok;
                }
                Err(e) => {
                    tracing::error!("{e}");
                    continue;
                }
            };

            if let Err(e) = sender
                .send(axum::extract::ws::Message::Text(json.into()))
                .await
            {
                tracing::error!("{e}");
            };
        }
    });

    let recv_task = tokio::spawn(async move { while let Some(Ok(_)) = receiver.next().await {} });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    leave_room(manager, room_id, user_identifier);
}
