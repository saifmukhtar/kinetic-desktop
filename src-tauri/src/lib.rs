mod api_commands;
mod installer;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// ---------------------------------------------------------------------------
// Window identifiers
// ---------------------------------------------------------------------------
const WINDOW_MAIN: &str = "main";

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------
const TRAY_ID: &str = "kinetic";
const TRAY_TOOLTIP: &str = "Kinetic";

// ---------------------------------------------------------------------------
// Tray menu item IDs
// ---------------------------------------------------------------------------
const MENU_ID_SHOW: &str = "show";
const MENU_ID_HIDE: &str = "hide";
const MENU_ID_QUIT: &str = "quit";

// ---------------------------------------------------------------------------
// Tray menu item labels
// ---------------------------------------------------------------------------
const MENU_LABEL_SHOW: &str = "Show Kinetic";
const MENU_LABEL_HIDE: &str = "Hide Window";
const MENU_LABEL_QUIT: &str = "Quit Kinetic";

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
const ERR_MISSING_APP_ICON: &str = "missing app icon";
const ERR_TAURI_RUN: &str = "error while running tauri application";

// ---------------------------------------------------------------------------

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(WINDOW_MAIN) {
        // On Linux/KDE, a minimized window must be unminimized first.
        // Calling show() on a minimized window does nothing on most WMs.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(api_commands::EndpointState {
            url: std::sync::Arc::new(std::sync::Mutex::new(String::new())),
            network_id: std::sync::Arc::new(std::sync::Mutex::new(String::new())),
        })
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, MENU_ID_SHOW, MENU_LABEL_SHOW, true, None::<&str>)?;
            let hide = MenuItem::with_id(app, MENU_ID_HIDE, MENU_LABEL_HIDE, true, None::<&str>)?;
            let quit = MenuItem::with_id(app, MENU_ID_QUIT, MENU_LABEL_QUIT, true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show, &hide, &separator, &quit])?;

            TrayIconBuilder::with_id(TRAY_ID)
                .tooltip(TRAY_TOOLTIP)
                .icon(app.default_window_icon().cloned().expect(ERR_MISSING_APP_ICON))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    MENU_ID_SHOW => show_main_window(app),
                    MENU_ID_HIDE => {
                        if let Some(window) = app.get_webview_window(WINDOW_MAIN) {
                            let _ = window.hide();
                        }
                    }
                    MENU_ID_QUIT => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => show_main_window(tray.app_handle()),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api_commands::set_active_endpoint,
            api_commands::get_active_endpoint,
            api_commands::get_api_url,
            api_commands::get_network_status,
            api_commands::get_network_nat,
            api_commands::get_network_peers,
            api_commands::resolve_name,
            api_commands::get_config_info,
            api_commands::create_session,
            api_commands::get_health,
            api_commands::get_peer_id,
            api_commands::get_banned_peers,
            api_commands::get_time,
            api_commands::resolve_kid,
            api_commands::get_zone,
            api_commands::get_owned_names,
            api_commands::publish_zone,
            api_commands::sign_and_publish_zone,
            api_commands::commit_name,
            api_commands::publish_name,
            api_commands::publish_kid,
            api_commands::publish_manifest,
            api_commands::update_config,
            api_commands::register_vdf,
            api_commands::renew_vdf,
            api_commands::get_takeover_iterations,
            api_commands::get_vdf_iterations,
            api_commands::get_vdf_status,
            api_commands::get_vdf_tasks,
            api_commands::delete_vdf_task,

            api_commands::get_local_kids,
            api_commands::get_local_kid,
            api_commands::generate_kid,
            api_commands::rotate_kid,
            api_commands::revoke_kid,
            api_commands::get_kid_manifest,
            api_commands::update_kid_manifest,
            installer::check_installed,
            installer::download_binaries,
            installer::install_binaries,
            api_commands::check_identity_status,
            api_commands::generate_seed_phrase,
            api_commands::save_seed_phrase,
            api_commands::list_proxy_rules,
            api_commands::add_custom_proxy,
            api_commands::remove_custom_proxy,
            api_commands::get_reserved_names,
            api_commands::get_local_reserved_zone,
            api_commands::save_local_reserved_zone,
            api_commands::delete_local_reserved_zone,
            api_commands::get_daemon_config,
            api_commands::get_ca_cert,
            api_commands::set_daemon_config,
            api_commands::get_action_status,
            api_commands::get_auth_sessions,
            api_commands::revoke_auth_session,
            api_commands::get_gossip_topics,
            api_commands::get_heartbeats,
            api_commands::gossip_publish,
            api_commands::gossip_subscribe,
            api_commands::post_authorized_update,
            api_commands::post_dns_flush,
            api_commands::post_heartbeat,
            api_commands::post_nrs_update,
            api_commands::publish_action,
        ])
        .run(tauri::generate_context!())
        .expect(ERR_TAURI_RUN);
}
