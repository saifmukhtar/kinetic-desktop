use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::command;

const BIN_DIR_UNIX: &str = "/usr/local/bin";

// ─────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct InstallStatus {
    pub is_installed: bool,
    pub install_type: Option<String>,
}

// ─────────────────────────────────────────────────────────────
// Step 0 — Check if already installed
// Runs as: Normal User
// Does:    Looks for the daemon binary in the system bin folder.
//          The frontend calls this on every startup. If the binary
//          exists, skip straight to the dashboard.
// ─────────────────────────────────────────────────────────────

#[command]
pub async fn check_installed() -> Result<InstallStatus, String> {
    let is_windows = env::consts::OS == "windows";
    let daemon_name = format!(
        "{}-daemon{}",
        kinetic_env::NSP,
        if is_windows { ".exe" } else { "" }
    );

    let bin_dir = if is_windows {
        PathBuf::from("C:\\Program Files\\Kinetic\\bin")
    } else {
        PathBuf::from(BIN_DIR_UNIX)
    };

    let daemon_path = bin_dir.join(&daemon_name);

    if daemon_path.exists() {
        Ok(InstallStatus {
            is_installed: true,
            install_type: Some("desktop".to_string()),
        })
    } else {
        Ok(InstallStatus {
            is_installed: false,
            install_type: None,
        })
    }
}

// ─────────────────────────────────────────────────────────────
// Step 1 — Create the user-owned directory tree
// Runs as: Normal User (no root required)
// Does:    Creates the full directory hierarchy owned by the
//          current desktop user BEFORE any root process touches
//          the filesystem. This guarantees the global kinetic/
//          and networks/ folders are permanently user-owned.
//
//          base_dir()     → ~/.local/share/kinetic
//          networks_dir() → ~/.local/share/kinetic/networks
//          nsp_dir()      → ~/.local/share/kinetic/networks/<nsp>-<salt>
//          pac_dir()      → ~/.local/share/kinetic/pac_router
// ─────────────────────────────────────────────────────────────

#[command]
pub async fn setup_user_dirs() -> Result<(), String> {
    fs::create_dir_all(kinetic_env::get_base_dir())
        .map_err(|e| format!("Failed to create base_dir: {}", e))?;

    fs::create_dir_all(kinetic_env::get_networks_dir())
        .map_err(|e| format!("Failed to create networks_dir: {}", e))?;

    fs::create_dir_all(kinetic_env::get_nsp_dir())
        .map_err(|e| format!("Failed to create nsp_dir: {}", e))?;

    fs::create_dir_all(kinetic_env::get_pac_dir())
        .map_err(|e| format!("Failed to create pac_dir: {}", e))?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────
// Step 2a — Check if the identity key already exists
// Runs as: Normal User (no root required)
// Does:    Returns true if nsp_dir/identity.key already exists.
//          The frontend uses this to decide whether to show
//          the key generation screen or skip it.
// ─────────────────────────────────────────────────────────────

#[command]
pub async fn check_identity_key() -> Result<bool, String> {
    let key_path = kinetic_env::get_identity_key_path();
    Ok(key_path.exists())
}

// ─────────────────────────────────────────────────────────────
// Step 2b — Extract bundled binaries to a temp staging directory
// Runs as: Normal User (no root required)
// Does:    Copies the binaries bundled inside the Tauri app
//          package out to a temporary directory so the
//          privileged install script can copy them from there.
// ─────────────────────────────────────────────────────────────

#[command]
pub async fn extract_bundled_binaries(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;

    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|_| "Failed to find resource directory".to_string())?
        .join("binaries");

    if !resource_path.exists() {
        return Err("Binaries resource folder not found in app bundle.".into());
    }

    let temp_dir = env::temp_dir().join(format!("kinetic-install-{}", kinetic_env::NSP));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    if let Ok(entries) = fs::read_dir(&resource_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().unwrap();
                let dest = temp_dir.join(file_name);
                fs::copy(&path, &dest)
                    .map_err(|e| format!("Failed to copy binary: {}", e))?;
            }
        }
    }

    Ok(temp_dir.to_string_lossy().to_string())
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Install system binaries and services (ONE root call)
// Runs as: Root/Admin (single password prompt)
// Does:    1. Copies binaries from temp staging to system bin.
//          2. Installs the daemon as a system-level service.
//          3. Starts the daemon service.
//          4. Runs chown to return ownership of the nsp_dir
//             back to the desktop user so the UI can write
//             identity.key and other user-owned data without
//             hitting permission errors.
//
// After this command returns OK, the frontend can immediately
// run PAC install/start as the normal user (Step 4 below).
// ─────────────────────────────────────────────────────────────

#[command]
pub async fn install_system() -> Result<(), String> {
    let is_windows = env::consts::OS == "windows";
    let is_macos = env::consts::OS == "macos";

    let temp_dir = env::temp_dir().join(format!("kinetic-install-{}", kinetic_env::NSP));
    if !temp_dir.exists() {
        return Err(
            "Staged binaries not found. Run extract_bundled_binaries first.".into(),
        );
    }

    // Capture the real desktop username and home BEFORE we escalate to root.
    // These are injected into the privileged script so we can chown correctly.
    let real_user = env::var("USER")
        .or_else(|_| env::var("USERNAME"))
        .unwrap_or_default();

    let real_home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_default();

    let dest_dir = if is_windows {
        "C:\\Program Files\\Kinetic\\bin".to_string()
    } else {
        BIN_DIR_UNIX.to_string()
    };

    let temp_dir_str = temp_dir.to_string_lossy().to_string();
    let cli_path = if is_windows {
        format!("{}\\{}.exe", dest_dir, kinetic_env::NSP)
    } else {
        format!("{}/{}", dest_dir, kinetic_env::NSP)
    };

    // The networks_dir path we will chown after the service boots.
    // This is the critical step that returns user-data ownership
    // back to the desktop user after root creates the daemon's
    // working directories inside nsp_dir.
    let networks_dir_str = kinetic_env::get_networks_dir()
        .to_string_lossy()
        .to_string();

    // Stop any existing PAC gracefully as the normal user BEFORE escalating.
    let _ = Command::new(&cli_path)
        .args(&["system", "pac", "stop"])
        .status();

    if is_windows {
        let mut script = String::new();

        // 1. Create destination directory
        script.push_str(&format!("$Dest = '{}'; ", dest_dir));
        script.push_str(
            "if (!(Test-Path $Dest)) { New-Item -ItemType Directory -Force -Path $Dest | Out-Null }; ",
        );

        // 2. Stop old daemon if running
        script.push_str(&format!(
            "& '{}' system daemon stop -ErrorAction SilentlyContinue; ",
            cli_path
        ));

        // 3. Copy staged binaries
        script.push_str(&format!(
            "Copy-Item -Path '{}\\*' -Destination $Dest -Force; ",
            temp_dir_str.replace('\\', "\\\\")
        ));

        // 4. Add to machine PATH if not already present
        script.push_str(
            "$OldPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine'); ",
        );
        script.push_str(&format!(
            "if ($OldPath -notmatch [regex]::Escape($Dest)) {{ [Environment]::SetEnvironmentVariable('PATH', $OldPath + ';' + $Dest, 'Machine') }}; "
        ));

        // 5. Install and start the daemon system service
        script.push_str(&format!("& '{}' system daemon install; ", cli_path));
        script.push_str(&format!("& '{}' system daemon start; ", cli_path));

        // 6. Grant full control of the networks_dir back to the desktop user
        //    so the UI can write identity keys without admin rights.
        let networks_win = networks_dir_str.replace('/', "\\");
        script.push_str(&format!(
            "icacls '{}' /grant '{}':(OI)(CI)F /T; ",
            networks_win, real_user
        ));

        let status = Command::new("powershell")
            .args(&[
                "-Command",
                &format!(
                    "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"{}\"' -Verb RunAs -Wait",
                    script.replace('"', "\"\"")
                ),
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to elevate privileges or install on Windows.".into());
        }
    } else if is_macos {
        let mut script = String::new();

        // 1. Create destination directory
        script.push_str(&format!("mkdir -p {}; ", dest_dir));

        // 2. Stop old daemon if running
        script.push_str(&format!("{} system daemon stop || true; ", cli_path));

        // 3. Copy staged binaries and make them executable
        script.push_str(&format!("cp {}/* {}; ", temp_dir_str, dest_dir));
        script.push_str(&format!("chmod +x {}/*; ", dest_dir));

        // 4. Install and start the daemon as a LaunchDaemon (system-level)
        script.push_str(&format!("{} system daemon install; ", cli_path));
        script.push_str(&format!("{} system daemon start; ", cli_path));

        // 5. Return networks_dir ownership to the desktop user
        script.push_str(&format!(
            "chown -R {}:{} '{}'; ",
            real_user, real_user, networks_dir_str
        ));

        let status = Command::new("osascript")
            .args(&[
                "-e",
                &format!(
                    "do shell script \"{}\" with administrator privileges",
                    script.replace('"', "\\\"")
                ),
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to elevate privileges or install on macOS.".into());
        }
    } else {
        // Linux
        let mut script = String::new();

        // 1. Create destination directory
        script.push_str(&format!("mkdir -p {}; ", dest_dir));

        // 2. Stop old daemon if running
        script.push_str(&format!("{} system daemon stop || true; ", cli_path));

        // 3. Copy staged binaries and make them executable
        script.push_str(&format!("cp -r {}/* {}; ", temp_dir_str, dest_dir));
        script.push_str(&format!("chmod +x {}/*; ", dest_dir));

        // 4. Install and start the daemon as a systemd system service
        script.push_str(&format!("{} system daemon install; ", cli_path));
        script.push_str(&format!("{} system daemon start; ", cli_path));

        // 5. Return networks_dir ownership to the desktop user.
        //    The daemon will have created nsp_dir internals as root during
        //    startup. This chown hands them back so the UI can write
        //    identity.key and other user data without permission errors.
        script.push_str(&format!(
            "chown -R {}:{} '{}'; ",
            real_user, real_user, networks_dir_str
        ));

        // Write the script to a temp file and execute via pkexec
        let script_path = temp_dir.join("install.sh");
        fs::write(&script_path, &script).map_err(|e| e.to_string())?;

        let status = Command::new("pkexec")
            .args(&["bash", script_path.to_str().unwrap()])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err(
                "Failed to elevate privileges or install on Linux. Is pkexec available?".into(),
            );
        }
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────
// Step 4 — Install and start the PAC router (normal user)
// Runs as: Normal User (no root required)
// Does:    Installs and starts kinetic-pac as a user-level
//          background service AFTER the daemon is running.
//          This is deliberately kept separate from install_system
//          because kinetic-pac must NOT run as root. It is a
//          global host router that reads user-owned pac_dir files.
// ─────────────────────────────────────────────────────────────

#[command]
pub async fn install_pac() -> Result<(), String> {
    let is_windows = env::consts::OS == "windows";

    let dest_dir = if is_windows {
        "C:\\Program Files\\Kinetic\\bin".to_string()
    } else {
        BIN_DIR_UNIX.to_string()
    };

    let cli_exec = if is_windows {
        format!("{}\\{}.exe", dest_dir, kinetic_env::NSP)
    } else {
        format!("{}/{}", dest_dir, kinetic_env::NSP)
    };

    Command::new(&cli_exec)
        .args(&["system", "pac", "install"])
        .status()
        .map_err(|e| format!("Failed to install PAC service: {}", e))?;

    Command::new(&cli_exec)
        .args(&["system", "pac", "start"])
        .status()
        .map_err(|e| format!("Failed to start PAC service: {}", e))?;

    Ok(())
}
