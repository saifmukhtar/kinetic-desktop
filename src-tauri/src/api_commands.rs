use std::path::PathBuf;
use tauri::command;
use kinetic_sdk::apis::configuration::Configuration;
use kinetic_sdk::apis::system_api;
use kinetic_sdk::apis::network_api;
use kinetic_sdk::apis::nrs_api;
use kinetic_sdk::apis::kid_api;
use kinetic_sdk::apis::vdf_api;
use kinetic_sdk::apis::auth_api;
use kinetic_sdk::apis::action_api;
use kinetic_sdk::apis::gossip_api;
use kinetic_sdk::apis::heartbeat_api;
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
const ROLE_VDF: &str = "vdf";

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
    match network_api::get_network_status(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get network status: {:?}", e)),
    }
}

#[command]
pub async fn get_network_nat(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match network_api::get_network_nat(&config).await {
        Ok(nat) => Ok(serde_json::to_value(nat).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get network NAT: {:?}", e)),
    }
}

#[command]
pub async fn get_network_peers(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match network_api::get_network_peers(&config).await {
        Ok(peers) => Ok(serde_json::to_value(peers).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get network peers: {:?}", e)),
    }
}

#[command]
pub async fn resolve_name(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match nrs_api::resolve_name(&config, &name).await {
        Ok(zone) => Ok(serde_json::to_value(zone).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to resolve name {}: {:?}", name, e)),
    }
}

#[command]
pub async fn get_config_info(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    match system_api::get_config(&config).await {
        Ok(info) => Ok(serde_json::to_value(info).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get config: {:?}", e)),
    }
}

#[command]
pub async fn create_session(
    app_name: String, 
    scopes: Vec<String>, 
    expiry_kyn: i32, 
    state: tauri::State<'_, EndpointState>
) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ADMIN, &state);

    let mut enum_scopes = Vec::new();
    for scope in scopes {
        let s = match scope.as_str() {
            "admin" => models::create_session_request::Scopes::Admin,
            "kid" => models::create_session_request::Scopes::Kid,
            "nrs" => models::create_session_request::Scopes::Nrs,
            "vdf" => models::create_session_request::Scopes::Vdf,
            "action" => models::create_session_request::Scopes::Action,
            "gossip" => models::create_session_request::Scopes::Gossip,
            "metric" => models::create_session_request::Scopes::Metric,
            "system" => models::create_session_request::Scopes::System,
            "atlas" => models::create_session_request::Scopes::Atlas,
            "heartbeat" => models::create_session_request::Scopes::Heartbeat,
            _ => return Err(format!("Invalid scope: {}", scope)),
        };
        enum_scopes.push(s);
    }

    let request = models::CreateSessionRequest::new(app_name, enum_scopes, expiry_kyn);
    
    match auth_api::create_session(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to create session: {:?}", e)),
    }
}

#[command]
pub async fn get_health(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match system_api::get_health(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get health: {:?}", e)),
    }
}

#[command]
pub async fn get_peer_id(state: tauri::State<'_, EndpointState>) -> Result<String, String> {
    let config = get_config(&state);
    match network_api::get_peer_id(&config).await {
        Ok(peer_id) => Ok(peer_id),
        Err(e) => Err(format!("Failed to get peer ID: {:?}", e)),
    }
}

#[command]
pub async fn get_banned_peers(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match network_api::get_banned_peers(&config).await {
        Ok(banned) => Ok(serde_json::to_value(banned).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get banned peers: {:?}", e)),
    }
}

#[command]
pub async fn get_time(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match system_api::get_time(&config).await {
        Ok(time) => Ok(serde_json::to_value(time).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get time: {:?}", e)),
    }
}

#[command]
pub async fn resolve_kid(did: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match kid_api::resolve_kid(&config, &did).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to resolve KID: {:?}", e)),
    }
}

#[command]
pub async fn get_zone(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match nrs_api::get_zone(&config, &name).await {
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
    match nrs_api::get_owned_names(&config).await {
        Ok(names) => Ok(names),
        Err(e) => Err(format!("Failed to get owned names: {:?}", e)),
    }
}

#[command]
pub async fn publish_zone(name: String, zone_data: models::NrsZone, state: tauri::State<'_, EndpointState>) -> Result<(), String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match nrs_api::save_zone(&config, &name, zone_data).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to save zone: {:?}", e)),
    }
}

#[command]
pub async fn sign_and_publish_zone(name: String, state: tauri::State<'_, EndpointState>) -> Result<(), String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match nrs_api::publish_zone(&config, &name).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to sign and publish zone: {:?}", e)),
    }
}

#[command]
pub async fn commit_name(commit_request: models::CommitRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match nrs_api::commit_name(&config, commit_request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to commit name: {:?}", e)),
    }
}

#[command]
pub async fn publish_name(publish_request: models::PublishRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match nrs_api::publish_name(&config, publish_request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish name: {:?}", e)),
    }
}

#[command]
pub async fn publish_kid(authorized_kid: models::AuthorizedKid, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match kid_api::publish_kid(&config, authorized_kid).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to publish KID: {:?}", e)),
    }
}

#[command]
pub async fn publish_manifest(authorized_manifest: models::AuthorizedManifest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match kid_api::publish_manifest(&config, authorized_manifest).await {
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
    match system_api::update_config(&config, update_config_request).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to update config: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// Public Tauri commands — vdf info
// ---------------------------------------------------------------------------

#[command]
pub async fn get_takeover_iterations(name: String, kyns_idle: i32, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match vdf_api::get_takeover_iterations(&config, &name, kyns_idle).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get takeover iterations: {:?}", e)),
    }
}

#[command]
pub async fn get_vdf_iterations(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match vdf_api::get_vdf_iterations(&config, &name).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get VDF iterations: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// Private Tauri commands — vdf role
// ---------------------------------------------------------------------------

#[command]
pub async fn register_vdf(request: models::VdfRegisterRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match vdf_api::vdf_register(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to register VDF: {:?}", e)),
    }
}

#[command]
pub async fn renew_vdf(request: models::NameRenewRequest, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match vdf_api::vdf_renew(&config, request).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to renew VDF: {:?}", e)),
    }
}

#[command]
pub async fn get_vdf_status(task_id: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match vdf_api::get_vdf_status(&config, &task_id).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get VDF status: {:?}", e)),
    }
}

#[command]
pub async fn delete_vdf_task(task_id: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_VDF, &state);
    match vdf_api::delete_vdf_task(&config, &task_id).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to delete VDF task: {:?}", e)),
    }
}



// ---------------------------------------------------------------------------
// Local KID Management Commands
// ---------------------------------------------------------------------------

#[command]
pub async fn get_local_kids(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match kid_api::list_kids(&config).await {
        Ok(kids) => Ok(serde_json::to_value(kids).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get local KIDs: {:?}", e)),
    }
}

#[command]
pub async fn get_local_kid(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match kid_api::fetch_kid(&config, &name).await {
        Ok(kid) => Ok(serde_json::to_value(kid).map_err(|e| e.to_string())?),
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



// ---------------------------------------------------------------------------
// Daemon Config
// ---------------------------------------------------------------------------

#[command]
pub async fn get_daemon_config(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    match system_api::get_config(&config).await {
        Ok(cfg) => Ok(serde_json::to_value(cfg).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get daemon config: {:?}", e)),
    }
}

#[command]
pub async fn set_daemon_config(config_data: serde_json::Value, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    let client = reqwest::Client::new();
    let url = format!("{}/config", config.base_path);
    
    // We send { "config": config_data } as expected by the daemon
    let mut req = client.post(&url).json(&serde_json::json!({ "config": config_data }));
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
        Err(e) => Err(format!("Failed to set daemon config: {:?}", e)),
    }
}

#[command]
pub async fn get_ca_cert(state: tauri::State<'_, EndpointState>) -> Result<String, String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    match system_api::get_ca_cert(&config).await {
        Ok(cert) => Ok(cert),
        Err(e) => Err(format!("Failed to get CA cert: {:?}", e)),
    }
}

// ---------------------------------------------------------------------------
// Local Zones (Private Overrides)
// ---------------------------------------------------------------------------

#[command]
pub async fn get_reserved_names(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match nrs_api::get_reserved_names(&config).await {
        Ok(names) => Ok(serde_json::to_value(names).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get reserved names: {:?}", e)),
    }
}

#[command]
pub async fn get_local_reserved_zone(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match nrs_api::get_local_reserved_zone(&config, &name).await {
        Ok(zone) => Ok(serde_json::to_value(zone).map_err(|e| e.to_string())?),
        Err(kinetic_sdk::apis::Error::ResponseError(res)) if res.status == reqwest::StatusCode::NOT_FOUND => {
            Ok(serde_json::Value::Null)
        },
        Err(e) => Err(format!("Failed to get local zone {}: {:?}", name, e)),
    }
}

#[command]
pub async fn save_local_reserved_zone(name: String, records: serde_json::Value, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    
    let zone: models::NrsZone = match serde_json::from_value(records) {
        Ok(z) => z,
        Err(e) => return Err(format!("Invalid zone data: {}", e)),
    };

    match nrs_api::save_local_reserved_zone(&config, &name, zone).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to save local zone {}: {:?}", name, e)),
    }
}

#[command]
pub async fn delete_local_reserved_zone(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    match nrs_api::delete_local_reserved_zone(&config, &name).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to delete local zone {}: {:?}", name, e)),
    }
}

#[command]
pub async fn get_kid_manifest(name: String, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match kid_api::fetch_kid_manifest(&config, &name).await {
        Ok(manifest) => Ok(serde_json::to_value(manifest).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get manifest for {}: {:?}", name, e)),
    }
}

#[command]
pub async fn update_kid_manifest(name: String, services: serde_json::Value, state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_PUBLISH, &state);
    
    // The SDK expects the raw JSON body
    let body = serde_json::json!({ "services": services });
    
    match kid_api::generate_kid_manifest(&config, &name, body).await {
        Ok(res) => Ok(serde_json::to_value(res).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to update manifest for {}: {:?}", name, e)),
    }
}

// ---------------------------------------------------------------------------
// Identity — Node Master Seed Commands
// ---------------------------------------------------------------------------

/// Path to the node identity key file within the kinetic data directory.
const IDENTITY_KEY_FILE: &str = "identity.key";

fn get_identity_key_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("kinetic")
        .join(IDENTITY_KEY_FILE)
}

/// Returns the status of the node's master identity key on disk.
///
/// Possible statuses: `"found"` (32-byte key present), `"not_found"` (no file),
/// `"corrupted"` (file exists but wrong size).
#[command]
pub async fn check_identity_status() -> Result<serde_json::Value, String> {
    let path = get_identity_key_path();
    if !path.exists() {
        return Ok(serde_json::json!({ "status": "not_found" }));
    }
    match std::fs::read(&path) {
        Ok(bytes) if bytes.len() == 32 => Ok(serde_json::json!({ "status": "found" })),
        Ok(bytes) => Ok(serde_json::json!({
            "status": "corrupted",
            "detail": format!("Expected 32 bytes, found {}", bytes.len())
        })),
        Err(e) => Ok(serde_json::json!({
            "status": "corrupted",
            "detail": format!("Read error: {}", e)
        })),
    }
}

/// Generates a fresh 24-word BIP-39 mnemonic from cryptographically secure entropy.
///
/// Returns the phrase and the indices of two random words the user must verify
/// before calling `save_seed_phrase`. The key is NOT saved at this stage.
#[command]
pub async fn generate_seed_phrase() -> Result<serde_json::Value, String> {
    use bip39::{Language, Mnemonic};

    let mut entropy = [0u8; 32];
    getrandom::getrandom(&mut entropy).map_err(|e| format!("Failed to generate entropy: {}", e))?;

    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)
        .map_err(|e| format!("Failed to create mnemonic: {}", e))?;

    let phrase = mnemonic.to_string();

    // Pick two distinct verification word indices from the entropy itself (mirrors CLI)
    let idx1 = (entropy[0] % 24) as usize;
    let mut idx2 = (entropy[1] % 24) as usize;
    if idx1 == idx2 {
        idx2 = (idx2 + 1) % 24;
    }

    Ok(serde_json::json!({
        "phrase": phrase,
        "verify_index_1": idx1,  // 0-based
        "verify_index_2": idx2,  // 0-based
    }))
}

/// Validates and saves a BIP-39 seed phrase to `identity.key`.
///
/// Derives the ML-DSA-65 seed using PBKDF2-HMAC-SHA512 with the network salt,
/// then atomically writes the 32-byte seed to disk with `0o600` permissions.
/// Used both for new identity init (after verification) and for restore.
#[command]
pub async fn save_seed_phrase(phrase: String) -> Result<serde_json::Value, String> {
    use bip39::{Language, Mnemonic};
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha512;
    use std::fs;
    use std::io::Write;
    #[cfg(unix)]
    use std::os::unix::fs::OpenOptionsExt;

    let path = get_identity_key_path();

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create identity directory: {}", e))?;
    }

    // 1. Parse BIP-39 mnemonic
    let mnemonic = Mnemonic::parse_in(Language::English, &phrase)
        .map_err(|e| format!("Invalid seed phrase: {}", e))?;
    let seed = mnemonic.to_seed(""); // No passphrase

    // 2. Parse NETWORK_SALT from build.rs environment
    let env_salt_str = env!("KINETIC_NETWORK_SALT");
    let mut network_salt = [0u8; 32];
    for (i, byte_str) in env_salt_str.split(',').enumerate() {
        if i >= 32 { break; }
        network_salt[i] = byte_str.parse::<u8>().map_err(|e| format!("Invalid compiled salt byte: {}", e))?;
    }

    // 3. Compute domain-separated PBKDF2 salt
    let mut salt = Vec::with_capacity(32 + 12);
    salt.extend_from_slice(&network_salt);
    salt.extend_from_slice(b"-seed-key-v1");

    // 4. Derive ML-DSA-65 seed via PBKDF2-HMAC-SHA512 (5 million iterations)
    let mut derived = [0u8; 32];
    #[cfg(debug_assertions)]
    let iterations = 1000;
    #[cfg(not(debug_assertions))]
    let iterations = 5_000_000;
    
    pbkdf2_hmac::<Sha512>(&seed, &salt, iterations, &mut derived);

    // 5. Write the 32-byte derived seed atomically with 0o600 permissions
    let mut opts = fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    opts.mode(0o600);
    
    let mut file = opts.open(&path).map_err(|e| format!("Failed to open identity key file: {}", e))?;
    file.write_all(&derived).map_err(|e| format!("Failed to write identity key file: {}", e))?;

    // 6. Zeroize buffers
    use zeroize::Zeroize;
    derived.zeroize();
    
    Ok(serde_json::json!({ "success": true }))
}

// ---------------------------------------------------------------------------
// PAC Proxy Routing Management
// ---------------------------------------------------------------------------

/// Returns the path to the universal kinetic pac_router proxies directory.
/// As per the new architecture, this is always under `kinetic/` globally,
/// not under a specific network_id.
fn get_pac_proxies_dir() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("kinetic")
        .join("pac_router")
        .join("proxies")
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProxyRuleInfo {
    pub filename: String,
    pub nsp: String,
    pub proxy_ip: String,
    pub proxy_port: u16,
    pub is_custom: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct RegisteredProxy {
    nsp: String,
    proxy_port: u16,
    #[serde(default = "default_proxy_ip")]
    proxy_ip: String,
}

fn default_proxy_ip() -> String {
    "127.0.0.1".to_string()
}

/// Lists all active routing rules currently registered in the PAC proxies folder.
#[command]
pub async fn list_proxy_rules() -> Result<Vec<ProxyRuleInfo>, String> {
    let proxies_dir = get_pac_proxies_dir();
    let mut rules = Vec::new();

    if !proxies_dir.exists() {
        return Ok(rules); // Empty list if directory doesn't exist yet
    }

    let entries = std::fs::read_dir(proxies_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if let Some(ext) = entry.path().extension() {
            if ext == "json" {
                let filename = entry.file_name().to_string_lossy().to_string();
                if let Ok(contents) = std::fs::read_to_string(entry.path()) {
                    if let Ok(proxy_info) = serde_json::from_str::<RegisteredProxy>(&contents) {
                        rules.push(ProxyRuleInfo {
                            filename: filename.clone(),
                            nsp: proxy_info.nsp,
                            proxy_ip: proxy_info.proxy_ip,
                            proxy_port: proxy_info.proxy_port,
                            is_custom: filename.starts_with("custom_"),
                        });
                    }
                }
            }
        }
    }

    // Sort: custom first, then alphabetical
    rules.sort_by(|a, b| b.is_custom.cmp(&a.is_custom).then(a.filename.cmp(&b.filename)));

    Ok(rules)
}

/// Adds a custom proxy routing rule to the PAC server.
#[command]
pub async fn add_custom_proxy(nsp: String, ip: String, port: u16) -> Result<(), String> {
    let proxies_dir = get_pac_proxies_dir();
    std::fs::create_dir_all(&proxies_dir).map_err(|e| e.to_string())?;

    let filename = format!("custom_{}.json", nsp.replace(|c: char| !c.is_alphanumeric(), "_"));
    let path = proxies_dir.join(filename);

    let proxy = RegisteredProxy {
        nsp,
        proxy_ip: ip,
        proxy_port: port,
    };

    let contents = serde_json::to_string_pretty(&proxy).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;

    Ok(())
}

/// Removes a custom proxy routing rule from the PAC server.
#[command]
pub async fn remove_custom_proxy(filename: String) -> Result<(), String> {
    if !filename.starts_with("custom_") || !filename.ends_with(".json") {
        return Err("Only custom proxy files can be deleted via this API.".into());
    }

    let path = get_pac_proxies_dir().join(filename);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    Ok(())
}


// ---------------------------------------------------------------------------
// Action & Auth
// ---------------------------------------------------------------------------

#[command]
pub async fn get_action_status(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match action_api::get_action_status(&config).await {
        Ok(status) => Ok(serde_json::to_value(status).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get action status: {:?}", e)),
    }
}

#[command]
pub async fn get_auth_sessions(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_private_config(ROLE_ADMIN, &state);
    match auth_api::list_sessions(&config).await {
        Ok(sessions) => Ok(serde_json::to_value(sessions).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get auth sessions: {:?}", e)),
    }
}

#[command]
pub async fn get_gossip_topics(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match gossip_api::get_gossip_topics(&config).await {
        Ok(topics) => Ok(serde_json::to_value(topics).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get gossip topics: {:?}", e)),
    }
}

#[command]
pub async fn get_heartbeats(state: tauri::State<'_, EndpointState>) -> Result<serde_json::Value, String> {
    let config = get_config(&state);
    match heartbeat_api::get_heartbeats(&config).await {
        Ok(heartbeats) => Ok(serde_json::to_value(heartbeats).map_err(|e| e.to_string())?),
        Err(e) => Err(format!("Failed to get heartbeats: {:?}", e)),
    }
}
