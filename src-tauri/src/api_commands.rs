use std::path::PathBuf;
use tauri::command;
use kinetic_sdk::apis::configuration::Configuration;
use kinetic_sdk::apis::public_api;
use kinetic_sdk::apis::private_api;
use kinetic_sdk::models;

// ---------------------------------------------------------------------------
// Environment variable names
// ---------------------------------------------------------------------------
const ENV_DATA_DIR: &str = "KINETIC_DATA_DIR";
const ENV_API_URL: &str = "KINETIC_API_URL";
const ENV_API_HOST: &str = "KINETIC_API_HOST";
const ENV_API_IP: &str = "KINETIC_API_IP";
const ENV_API_PORT: &str = "KINETIC_API_PORT";
const ENV_CONFIG_PATH: &str = "KINETIC_CONFIG_PATH";

// ---------------------------------------------------------------------------
// Default network values
// ---------------------------------------------------------------------------
const API_PATH_PREFIX: &str = "http://";
const API_PATH_SUFFIX: &str = "/api";

// ---------------------------------------------------------------------------
// Directory and file names
// ---------------------------------------------------------------------------
const CONFIG_FILE_NAME: &str = "config.toml";

// ---------------------------------------------------------------------------
// config.toml TOML keys
// ---------------------------------------------------------------------------
const TOML_SECTION_DAEMON: &str = "daemon";
const TOML_KEY_API_PORT: &str = "api_port";
const TOML_KEY_BIND_IP: &str = "bind_ip";

// ---------------------------------------------------------------------------
// Auth token role names
// ---------------------------------------------------------------------------
const ROLE_ADMIN: &str = "admin";
const ROLE_PUBLISH: &str = "publish";
const ROLE_ATLAS: &str = "atlas";
const ROLE_VDF: &str = "vdf";

// ---------------------------------------------------------------------------
// Atlas network discovery
// ---------------------------------------------------------------------------
const LOCAL_NETWORKS_FILE: &str = "networks/tlds.json";
const ATLAS_NETWORKS_URL: &str =
    "https://raw.githubusercontent.com/saifmukhtar/kinetic-atlas/main/index.json";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

pub struct EndpointState {
    pub url: std::sync::Arc<std::sync::Mutex<String>>,
    pub network_id: std::sync::Arc<std::sync::Mutex<String>>,
}

fn get_base_dir(network_id: &str) -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(network_id)
}

fn get_config(state: &tauri::State<EndpointState>) -> Configuration {
    let mut config = Configuration::new();
    let url = state.url.lock().unwrap().clone();
    config.base_path = url;
    config
}

fn get_private_config(role: &str, state: &tauri::State<EndpointState>) -> Configuration {
    let mut config = get_config(state);
    let net_id = state.network_id.lock().unwrap().clone();
    
    let token_path = get_base_dir(&net_id)
        .join("tokens")
        .join(format!("{}{}", role, ".token"));

    if let Ok(token) = std::fs::read_to_string(token_path) {
        config.bearer_access_token = Some(token.trim().to_string());
    }
    config
}

// ---------------------------------------------------------------------------
// State Management Commands
// ---------------------------------------------------------------------------

#[command]
pub async fn set_active_endpoint(
    ip: String, 
    port: u16, 
    network_id: String, 
    state: tauri::State<'_, EndpointState>
) -> Result<(), String> {
    let mut url_lock = state.url.lock().unwrap();
    *url_lock = format!("http://{}:{}/api", ip, port);
    
    let mut net_lock = state.network_id.lock().unwrap();
    *net_lock = network_id;
    
    Ok(())
}

#[command]
pub async fn get_active_endpoint(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let url = state.url.lock().unwrap().clone();
    let net_id = state.network_id.lock().unwrap().clone();
    Ok(serde_json::json!({
        "url": url,
        "network_id": net_id
    }))
}

// ---------------------------------------------------------------------------
// Public Tauri commands
// ---------------------------------------------------------------------------

#[command]
pub async fn get_api_url(state: tauri::State<'_, EndpointState>) -> Result<String, String> {
    let config = get_config(&state);
    Ok(config.base_path)
}

#[command]
pub async fn get_network_status(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match public_api::get_network_status(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get network status: {:?}", e)),
    }
}

#[command]
pub async fn resolve_name(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match public_api::resolve_name(&config, &name).await {
        Ok(zone) => Ok(serde_json::to_value(zone).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to resolve name {}: {:?}", name, e)),
    }
}

#[command]
pub async fn get_config_info(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    match private_api::get_config(&config).await {
        Ok(info) => Ok(serde_json::to_value(info).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get config: {:?}", e)),
    }
}

#[command]
pub async fn sync_atlas(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ATLAS, &state);
    match private_api::sync_atlas(&config).await {
        Ok(resp) => Ok(serde_json::to_value(resp).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to sync atlas: {:?}", e)),
    }
}

#[command]
pub async fn get_health(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match public_api::get_health(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get health: {:?}", e)),
    }
}

#[command]
pub async fn get_peer_id(state: tauri::State<'_, EndpointState>) -> Result<String, String> {
    let config = get_config(&state);
    match public_api::get_peer_id(&config).await {
        Ok(peer_id) => Ok(peer_id),
        Err(e) => Err(format!("Failed to get peer ID: {:?}", e)),
    }
}

#[command]
pub async fn get_time(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match public_api::get_time(&config).await {
        Ok(time) => Ok(serde_json::to_value(time).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get time: {:?}", e)),
    }
}

#[command]
pub async fn resolve_kid(did: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match public_api::resolve_kid(&config, &did).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to resolve KID: {:?}", e)),
    }
}

#[command]
pub async fn get_zone(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match public_api::get_zone(&config, &name).await {
        Ok(zone) => Ok(serde_json::to_value(zone).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get zone {}: {:?}", name, e)),
    }
}

// ---------------------------------------------------------------------------
// Private Tauri commands — publish role
// ---------------------------------------------------------------------------

#[command]
pub async fn get_owned_names(state: tauri::State<'_, EndpointState>) -> Result<Vec<String>, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::get_owned_names(&config).await {
        Ok(names) => Ok(names),
        Err(e) => Err(format!("Failed to get owned names: {:?}", e)),
    }
}

#[command]
pub async fn publish_zone(name: String, zone_data: models::DnsZone, state: tauri::State<'_, EndpointState>) -> Result<(), String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::save_zone(&config, &name, zone_data).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to save zone: {:?}", e)),
    }
}

#[command]
pub async fn sign_and_publish_zone(name: String, state: tauri::State<'_, EndpointState>) -> Result<(), String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::publish_zone(&config, &name).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to sign and publish zone: {:?}", e)),
    }
}

#[command]
pub async fn commit_name(commit_request: models::CommitRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::commit_name(&config, commit_request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to commit name: {:?}", e)),
    }
}

#[command]
pub async fn publish_name(publish_request: models::PublishRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::publish_name(&config, publish_request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish name: {:?}", e)),
    }
}

#[command]
pub async fn publish_kid(authorized_kid: models::AuthorizedKid, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::publish_kid(&config, authorized_kid).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish KID: {:?}", e)),
    }
}

#[command]
pub async fn publish_manifest(authorized_manifest: models::AuthorizedManifest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match private_api::publish_manifest(&config, authorized_manifest).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish manifest: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// Private Tauri commands — admin role
// ---------------------------------------------------------------------------

#[command]
pub async fn update_config(update_config_request: models::UpdateConfigRequest, state: tauri::State<'_, EndpointState>) -> Result<(), String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    match private_api::update_config(&config, update_config_request).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to update config: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// Private Tauri commands — vdf role
// ---------------------------------------------------------------------------

#[command]
pub async fn register_vdf(request: models::VdfRegisterRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match private_api::vdf_register(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to register VDF: {:?}", e)),
    }
}

#[command]
pub async fn renew_vdf(request: models::NameRenewRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match private_api::vdf_renew(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to renew VDF: {:?}", e)),
    }
}

#[command]
pub async fn get_vdf_status(task_id: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match private_api::get_vdf_status(&config, &task_id).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get VDF status: {:?}", e)),
    }
}

#[command]
pub async fn delete_vdf_task(task_id: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match private_api::delete_vdf_task(&config, &task_id).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to delete VDF task: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// Atlas network discovery
// ---------------------------------------------------------------------------

#[command]
pub async fn get_atlas_networks() -> Result<serde_json::Value, String> {
    match reqwest::get(ATLAS_NETWORKS_URL).await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(json) => Ok(json),
            Err(e) => Err(format!("Failed to parse Atlas networks JSON: {:?}", e)),
        },
        Err(e) => Err(format!("Failed to fetch Atlas networks from {}: {:?}", ATLAS_NETWORKS_URL, e)),
    }
}

// ---------------------------------------------------------------------------
// Local KID Management Commands
// ---------------------------------------------------------------------------

#[command]
pub async fn get_local_kids(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid", config.base_path);
    match client.get(&url).send().await {
        Ok(resp) => resp.json::<serde_json::Value>().await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Failed to get local KIDs from {}: {:?}", url, e)),
    }
}

#[command]
pub async fn get_local_kid(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid/{}", config.base_path, name);
    match client.get(&url).send().await {
        Ok(resp) => resp.json::<serde_json::Value>().await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Failed to get local KID for {}: {:?}", name, e)),
    }
}

#[command]
pub async fn generate_kid(
    base_name: String,
    sub_name: Option<String>,
    inherit_subname: Option<bool>,
    force: Option<bool>,
    state: tauri::State<'_, EndpointState>,
) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid", config.base_path);
    let mut req = client.post(&url).json(&serde_json::json!({
        "base_name": base_name,
        "sub_name": sub_name,
        "inherit_subname": inherit_subname.unwrap_or(true),
        "force": force.unwrap_or(false),
    }));
    if let Some(token) = &config.bearer_access_token {
        req = req.bearer_auth(token);
    }
    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                Err(format!("Daemon error: {}", err_text))
            }
        }
        Err(e) => Err(format!("Failed to generate KID: {:?}", e)),
    }
}

#[command]
pub async fn rotate_kid(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid/{}/rotate", config.base_path, name);
    let mut req = client.post(&url);
    if let Some(token) = &config.bearer_access_token {
        req = req.bearer_auth(token);
    }
    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                Err(format!("Daemon error: {}", err_text))
            }
        }
        Err(e) => Err(format!("Failed to rotate KID for {}: {:?}", name, e)),
    }
}

#[command]
pub async fn revoke_kid(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid/{}/revoke", config.base_path, name);
    let mut req = client.post(&url);
    if let Some(token) = &config.bearer_access_token {
        req = req.bearer_auth(token);
    }
    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                Err(format!("Daemon error: {}", err_text))
            }
        }
        Err(e) => Err(format!("Failed to revoke KID for {}: {:?}", name, e)),
    }
}

#[command]
pub async fn get_kid_manifest(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid/{}/manifest", config.base_path, name);
    match client.get(&url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                Err(format!("Daemon error: {}", err_text))
            }
        }
        Err(e) => Err(format!("Failed to get manifest for {}: {:?}", name, e)),
    }
}

#[command]
pub async fn update_kid_manifest(name: String, services: serde_json::Value, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    let client = reqwest::Client::new();
    let url = format!("{}/kid/{}/manifest", config.base_path, name);
    let mut req = client.post(&url).json(&serde_json::json!({ "services": services }));
    if let Some(token) = &config.bearer_access_token {
        req = req.bearer_auth(token);
    }
    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                Err(format!("Daemon error: {}", err_text))
            }
        }
        Err(e) => Err(format!("Failed to update manifest for {}: {:?}", name, e)),
    }
}



