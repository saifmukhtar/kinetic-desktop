use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::command;
use serde::Serialize;

const BIN_DIR_UNIX: &str = "/usr/local/bin";

#[derive(Serialize)]
pub struct InstallStatus {
    pub is_installed: bool,
    pub install_type: Option<String>,
}

#[command]
pub async fn check_installed(network_id: String) -> Result<InstallStatus, String> {
    let is_windows = env::consts::OS == "windows";
    let daemon_name = if is_windows { format!("{}-daemon.exe", network_id) } else { format!("{}-daemon", network_id) };
    let dns_name = if is_windows { format!("{}-dns.exe", network_id) } else { format!("{}-dns", network_id) };

    let bin_dir = if is_windows {
        let dir = format!("C:\\Program Files\\{}\\bin", network_id);
        PathBuf::from(dir)
    } else {
        PathBuf::from(BIN_DIR_UNIX)
    };

    let daemon_path = bin_dir.join(&daemon_name);
    let dns_path = bin_dir.join(&dns_name);

    if daemon_path.exists() {
        let install_type = if dns_path.exists() { "full" } else { "minimal" };
        Ok(InstallStatus {
            is_installed: true,
            install_type: Some(install_type.to_string()),
        })
    } else {
        Ok(InstallStatus {
            is_installed: false,
            install_type: None,
        })
    }
}

#[command]
pub async fn extract_bundled_binaries(
    app: tauri::AppHandle,
    network_id: String,
) -> Result<String, String> {
    use tauri::Manager;
    
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|_| "Failed to find resource directory".to_string())?
        .join("binaries");
        
    if !resource_path.exists() {
        return Err("Binaries resource folder not found in app bundle.".into());
    }

    let temp_dir = env::temp_dir().join(format!("kinetic-install-{}", network_id));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Copy all files from resources/binaries to temp_dir
    if let Ok(entries) = fs::read_dir(&resource_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().unwrap();
                let dest = temp_dir.join(file_name);
                fs::copy(&path, &dest).map_err(|e| format!("Failed to copy binary: {}", e))?;
            }
        }
    }

    Ok(temp_dir.to_string_lossy().to_string())
}

#[command]
pub async fn install_binaries(network_id: String, install_type: String) -> Result<(), String> {
    let temp_dir = env::temp_dir().join(format!("kinetic-install-{}", network_id));
    if !temp_dir.exists() {
        return Err("Installation files not found in temp directory.".into());
    }

    let is_windows = env::consts::OS == "windows";
    let is_macos = env::consts::OS == "macos";
    
    let dest_dir = if is_windows { 
        format!("C:\\Program Files\\{}\\bin", network_id) 
    } else { 
        BIN_DIR_UNIX.to_string() 
    };
    let temp_dir_str = temp_dir.to_string_lossy().to_string();

    let mut shell_script = String::new();

    if is_windows {
        // Windows script: Copy files to C:\Program Files\Kinetic\bin and run kinetic daemon install
        shell_script.push_str(&format!(
            "$DestDir = '{}'; ",
            dest_dir
        ));
        shell_script.push_str("if (!(Test-Path $DestDir)) { New-Item -ItemType Directory -Force -Path $DestDir | Out-Null }; ");
        // Stop services first
        shell_script.push_str(&format!("& '{}\\{}.exe' daemon stop -ErrorAction SilentlyContinue; ", dest_dir, network_id));
        shell_script.push_str(&format!("& '{}\\{}.exe' dns stop -ErrorAction SilentlyContinue; ", dest_dir, network_id));
        shell_script.push_str(&format!("& '{}\\{}.exe' pac stop -ErrorAction SilentlyContinue; ", dest_dir, network_id));

        // Copy files
        shell_script.push_str(&format!(
            "Copy-Item -Path '{}*' -Destination $DestDir -Force; ",
            temp_dir_str.replace("\\", "\\\\") + "\\\\"
        ));
        
        // Add to machine PATH if not exists
        shell_script.push_str(
            "$OldPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine'); "
        );
        shell_script.push_str(&format!(
            "if ($OldPath -notmatch [regex]::Escape($DestDir)) {{ [Environment]::SetEnvironmentVariable('PATH', $OldPath + ';' + $DestDir, 'Machine') }}; "
        ));

        // Install & Start services
        shell_script.push_str(&format!("& '{}\\{}.exe' daemon install; ", dest_dir, network_id));
        shell_script.push_str(&format!("& '{}\\{}.exe' daemon start; ", dest_dir, network_id));

        if install_type == "full" {
            shell_script.push_str(&format!("& '{}\\{}.exe' dns install; ", dest_dir, network_id));
            shell_script.push_str(&format!("& '{}\\{}.exe' dns start; ", dest_dir, network_id));
            shell_script.push_str(&format!("& '{}\\{}.exe' pac install; ", dest_dir, network_id));
            shell_script.push_str(&format!("& '{}\\{}.exe' pac start; ", dest_dir, network_id));
        }

        let status = Command::new("powershell")
            .args(&[
                "-Command",
                &format!("Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"{}\"' -Verb RunAs -Wait", shell_script.replace("\"", "\"\""))
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to elevate privileges or install on Windows.".into());
        }

    } else if is_macos {
        // macOS script
        shell_script.push_str(&format!("mkdir -p {}; ", dest_dir));
        
        let cli_path = format!("{}/{}", dest_dir, network_id);
        // Stop services first (if they exist)
        shell_script.push_str(&format!("{} daemon stop || true; ", cli_path));
        shell_script.push_str(&format!("{} dns stop || true; ", cli_path));
        shell_script.push_str(&format!("{} pac stop || true; ", cli_path));

        shell_script.push_str(&format!("cp {}/* {}; ", temp_dir_str, dest_dir));
        
        shell_script.push_str(&format!("{} daemon install; ", cli_path));
        shell_script.push_str(&format!("{} daemon start; ", cli_path));

        if install_type == "full" {
            shell_script.push_str(&format!("{} dns install; ", cli_path));
            shell_script.push_str(&format!("{} dns start; ", cli_path));
            shell_script.push_str(&format!("{} pac install; ", cli_path));
            shell_script.push_str(&format!("{} pac start; ", cli_path));
        }

        let status = Command::new("osascript")
            .args(&[
                "-e",
                &format!("do shell script \"{}\" with administrator privileges", shell_script.replace("\"", "\\\""))
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to elevate privileges or install on macOS.".into());
        }

    } else {
        // Linux script
        shell_script.push_str(&format!("mkdir -p {}; ", dest_dir));
        
        let cli_path = format!("{}/{}", dest_dir, network_id);
        // Stop services first (if they exist)
        shell_script.push_str(&format!("{} daemon stop || true; ", cli_path));
        shell_script.push_str(&format!("{} dns stop || true; ", cli_path));
        shell_script.push_str(&format!("{} pac stop || true; ", cli_path));

        shell_script.push_str(&format!("cp -r {}/* {}; ", temp_dir_str, dest_dir));
        
        shell_script.push_str(&format!("{} daemon install; ", cli_path));
        shell_script.push_str(&format!("{} daemon start; ", cli_path));

        if install_type == "full" {
            shell_script.push_str(&format!("{} dns install; ", cli_path));
            shell_script.push_str(&format!("{} dns start; ", cli_path));
            shell_script.push_str(&format!("{} pac install; ", cli_path));
            shell_script.push_str(&format!("{} pac start; ", cli_path));
        }

        // Write to temp sh file and pkexec
        let script_path = temp_dir.join("install.sh");
        fs::write(&script_path, &shell_script).map_err(|e| e.to_string())?;
        
        let status = Command::new("pkexec")
            .args(&["bash", script_path.to_str().unwrap()])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to elevate privileges or install on Linux. Ensure pkexec is available.".into());
        }
    }

    Ok(())
}
