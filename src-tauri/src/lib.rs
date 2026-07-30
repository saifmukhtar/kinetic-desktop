mod installer;
mod api_commands;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show Kinetic", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Kinetic", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show, &hide, &separator, &quit])?;

            TrayIconBuilder::with_id("kinetic")
                .tooltip("Kinetic")
                .icon(app.default_window_icon().cloned().expect("missing app icon"))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => app.exit(0),
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
            greet,
            installer::install_profile,
            installer::install_fork_daemon,
            api_commands::get_api_url,
            api_commands::get_network_status,
            api_commands::resolve_name,
            api_commands::get_config_info,
            api_commands::sync_atlas,
            api_commands::get_health,
            api_commands::get_peer_id,
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
            api_commands::get_vdf_status,
            api_commands::delete_vdf_task,
            api_commands::get_atlas_networks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
