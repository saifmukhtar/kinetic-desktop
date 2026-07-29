use std::path::PathBuf;
use tauri::command;
use kinetic_sdk::apis::configuration::Configuration;
use kinetic_sdk::apis::public_api;
use kinetic_sdk::apis::private_api;
use kinetic_sdk::models;

fn get_base_dir() -> PathBuf {
    // Exact match of kinetic-core's get_base_dir() logic
    if let Ok(path) = std::env::var("KINETIC_DATA_DIR") {
        return PathBuf::from(path);
    }
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("kinetic")
}

fn get_api_endpoint() -> (String, u16) {
    let mut ip = "127.0.0.1".to_string();
    let mut port = 16002;
    let config_path = std::env::var("KINETIC_CONFIG_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| get_base_dir().join("config.toml"));

    if let Ok(content) = std::fs::read_to_string(config_path) {
        if let Ok(toml_val) = toml::from_str::<toml::Value>(&content) {
            if let Some(daemon) = toml_val.get("daemon") {
                if let Some(p) = daemon.get("api_port").and_then(|v| v.as_integer()) {
                    port = p as u16;
                }
                if let Some(i) = daemon.get("bind_ip").and_then(|v| v.as_str()) {
                    ip = i.to_string();
                }
            }
        }
    }
    
    // HTTP clients often fail to connect directly to the wildcard "0.0.0.0" address.
    // If the daemon binds to all interfaces, we should connect via localhost.
    if ip == "0.0.0.0" {
        ip = "127.0.0.1".to_string();
    }
    
    (ip, port)
}

fn get_config() -> Configuration {
    let mut config = Configuration::new();
    let (ip, port) = get_api_endpoint();
    config.base_path = format!("http://{}:{}/api", ip, port);
    config
}

fn get_private_config(role: &str) -> Configuration {
    let mut config = get_config();
    let token_path = get_base_dir().join("tokens").join(format!("{}.token", role));
    
    if let Ok(token) = std::fs::read_to_string(token_path) {
        config.bearer_access_token = Some(token.trim().to_string());
    }
    config
}

#[command]
pub async fn get_network_status() -> Result<serde_json::Value, String> {
    let config = get_config();
    match public_api::network_status_get(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get network status: {:?}", e)),
    }
}

#[command]
pub async fn resolve_name(name: String) -> Result<serde_json::Value, String> {
    let config = get_config();
    match public_api::resolve_name_get(&config, &name).await {
        Ok(zone) => Ok(serde_json::to_value(zone).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to resolve name {}: {:?}", name, e)),
    }
}

#[command]
pub async fn get_config_info() -> Result<serde_json::Value, String> {
    let config = get_private_config("admin");
    match private_api::config_get(&config).await {
        Ok(info) => Ok(serde_json::to_value(info).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get config: {:?}", e)),
    }
}

#[command]
pub async fn sync_atlas() -> Result<serde_json::Value, String> {
    let config = get_private_config("atlas");
    match private_api::internal_atlas_sync_post(&config).await {
        Ok(resp) => Ok(serde_json::to_value(resp).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to sync atlas: {:?}", e)),
    }
}

#[command]
pub async fn get_health() -> Result<serde_json::Value, String> {
    let config = get_config();
    match public_api::health_get(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get health: {:?}", e)),
    }
}

#[command]
pub async fn get_peer_id() -> Result<String, String> {
    let config = get_config();
    match public_api::peer_id_get(&config).await {
        Ok(peer_id) => Ok(peer_id),
        Err(e) => Err(format!("Failed to get peer ID: {:?}", e)),
    }
}

#[command]
pub async fn get_time() -> Result<serde_json::Value, String> {
    let config = get_config();
    match public_api::time_get(&config).await {
        Ok(time) => Ok(serde_json::to_value(time).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get time: {:?}", e)),
    }
}

#[command]
pub async fn resolve_kid(did: String) -> Result<serde_json::Value, String> {
    let config = get_config();
    match public_api::resolve_kid_did_get(&config, &did).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to resolve KID: {:?}", e)),
    }
}

#[command]
pub async fn get_zone(name: String) -> Result<serde_json::Value, String> {
    let config = get_config();
    match public_api::zone_name_get(&config, &name).await {
        Ok(zone) => Ok(serde_json::to_value(zone).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get zone {}: {:?}", name, e)),
    }
}

#[command]
pub async fn get_owned_names() -> Result<Vec<String>, String> {
    let config = get_private_config("publish");
    match private_api::owned_names_get(&config).await {
        Ok(names) => Ok(names),
        Err(e) => Err(format!("Failed to get owned names: {:?}", e)),
    }
}

#[command]
pub async fn publish_zone(name: String, zone_data: models::DnsZone) -> Result<(), String> {
    let config = get_private_config("publish");
    match private_api::zone_name_post(&config, &name, zone_data).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to publish zone: {:?}", e)),
    }
}

#[command]
pub async fn sign_and_publish_zone(name: String) -> Result<(), String> {
    let config = get_private_config("publish");
    match private_api::zone_name_publish_post(&config, &name).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to sign and publish zone: {:?}", e)),
    }
}

#[command]
pub async fn commit_name(commit_request: models::CommitRequest) -> Result<serde_json::Value, String> {
    let config = get_private_config("publish");
    match private_api::commit_post(&config, commit_request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to commit name: {:?}", e)),
    }
}

#[command]
pub async fn publish_name(publish_request: models::PublishRequest) -> Result<serde_json::Value, String> {
    let config = get_private_config("publish");
    match private_api::publish_post(&config, publish_request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish name: {:?}", e)),
    }
}

#[command]
pub async fn publish_kid(authorized_kid: models::AuthorizedKid) -> Result<serde_json::Value, String> {
    let config = get_private_config("publish");
    match private_api::publish_kid_post(&config, authorized_kid).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish KID: {:?}", e)),
    }
}

#[command]
pub async fn publish_manifest(authorized_manifest: models::AuthorizedManifest) -> Result<serde_json::Value, String> {
    let config = get_private_config("publish");
    match private_api::publish_manifest_post(&config, authorized_manifest).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish manifest: {:?}", e)),
    }
}

#[command]
pub async fn update_config(config_post_request: models::ConfigPostRequest) -> Result<(), String> {
    let config = get_private_config("admin");
    match private_api::config_post(&config, config_post_request).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to update config: {:?}", e)),
    }
}



#[command]
pub async fn register_vdf(request: models::VdfRegisterRequest) -> Result<serde_json::Value, String> {
    let config = get_private_config("vdf");
    match private_api::vdf_register_post(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to register VDF: {:?}", e)),
    }
}

#[command]
pub async fn renew_vdf(request: models::NameRenewRequest) -> Result<serde_json::Value, String> {
    let config = get_private_config("vdf");
    match private_api::vdf_renew_post(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to renew VDF: {:?}", e)),
    }
}

#[command]
pub async fn get_vdf_status(task_id: String) -> Result<serde_json::Value, String> {
    let config = get_private_config("vdf");
    match private_api::vdf_status_task_id_get(&config, &task_id).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get VDF status: {:?}", e)),
    }
}

#[command]
pub async fn delete_vdf_task(task_id: String) -> Result<serde_json::Value, String> {
    let config = get_private_config("vdf");
    match private_api::vdf_status_task_id_delete(&config, &task_id).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to delete VDF task: {:?}", e)),
    }
}

#[command]
pub async fn get_atlas_networks() -> Result<serde_json::Value, String> {
    let url = "https://raw.githubusercontent.com/saifmukhtar/kinetic-atlas/main/index.json";
    match reqwest::get(url).await {
        Ok(resp) => {
            match resp.json::<serde_json::Value>().await {
                Ok(json) => Ok(json),
                Err(e) => Err(format!("Failed to parse Atlas networks JSON: {:?}", e)),
            }
        },
        Err(e) => Err(format!("Failed to fetch Atlas networks: {:?}", e)),
    }
}


