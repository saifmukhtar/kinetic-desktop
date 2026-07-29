use std::env;
use std::process::Command;
use tauri::command;

#[command]
pub async fn install_profile(profile: String, clean: bool) -> Result<String, String> {
    let os = env::consts::OS;
    let username = env::var("USER").or_else(|_| env::var("USERNAME")).unwrap_or_default();
    let config_dir = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).to_string_lossy().to_string();
    
    // Determine the binaries to install based on the profile
    let mut bins = vec!["kinetic-cli"];
    let mut install_dns = false;
    
    match profile.as_str() {
        "minimal" => {
            bins.push("kinetic-daemon");
        }
        "complete" => {
            bins.push("kinetic-daemon");
            bins.push("kinetic-dns");
            install_dns = true;
        }
        _ => return Err("Invalid profile selected".into()),
    }

    match os {
        "linux" => install_linux(bins, install_dns, clean, &username, &config_dir),
        "macos" => install_macos(bins, install_dns, clean, &username, &config_dir),
        "windows" => install_windows(bins, install_dns, clean, &username, &config_dir),
        _ => Err(format!("Unsupported OS: {}", os)),
    }
}

fn install_linux(bins: Vec<&str>, install_dns: bool, clean: bool, username: &str, config_dir: &str) -> Result<String, String> {
    let mut script = String::new();
    script.push_str("set -e\n");

    if clean {
        script.push_str("rm -f /usr/local/bin/kinetic-daemon /usr/local/bin/kinetic-cli /usr/local/bin/kinetic-dns\n");
        script.push_str("if systemctl is-active --quiet kinetic-daemon; then systemctl stop kinetic-daemon || true; fi\n");
        script.push_str("if systemctl is-active --quiet kinetic-dns; then systemctl stop kinetic-dns || true; fi\n");
        script.push_str("systemctl disable kinetic-daemon || true\n");
        script.push_str("systemctl disable kinetic-dns || true\n");
        script.push_str("rm -f /etc/systemd/system/kinetic-daemon.service /etc/systemd/system/kinetic-dns.service\n");
        script.push_str("systemctl daemon-reload || true\n");
        script.push_str("sleep 1\n");
        script.push_str(&format!("rm -rf '{}/kinetic'\n", config_dir));
        script.push_str("sleep 1\n");
    }
    
    for bin in bins {
        let url = format!("https://github.com/saifmukhtar/kinetic/releases/latest/download/{}-linux", bin);
        script.push_str(&format!(
            "echo 'Downloading {} from GitHub releases...'\ncurl -sL {} -o /tmp/{}\ncp /tmp/{} /usr/local/bin/{}\nchmod +x /usr/local/bin/{}\nrm /tmp/{}\n",
            bin, url, bin, bin, bin, bin, bin
        ));
        if bin != "kinetic-cli" {
            if bin == "kinetic-daemon" {
                script.push_str(&format!(
                    "/usr/local/bin/kinetic-daemon install --user {} --config-dir '{}/kinetic'\n/usr/local/bin/kinetic-daemon start-service\n",
                    username, config_dir
                ));
            } else {
                script.push_str(&format!(
                    "/usr/local/bin/{} install\n/usr/local/bin/{} start-service\n",
                    bin, bin
                ));
            }
        }
    }

    script.push_str(&format!("chown -R {} '{}/kinetic'\n", username, config_dir));

    if install_dns {
        script.push_str(
            "if systemctl is-active --quiet systemd-resolved; then\n\
                mkdir -p /etc/systemd/resolved.conf.d/\n\
                echo -e '[Resolve]\\nDNS=127.0.0.2\\nDomains=~kin' > /etc/systemd/resolved.conf.d/kinetic.conf\n\
                systemctl restart systemd-resolved\n\
             fi\n"
        );
    }

    // Run via pkexec
    let output = Command::new("pkexec")
        .arg("bash")
        .arg("-c")
        .arg(&script)
        .env_remove("DESKTOP_STARTUP_ID")
        .env_remove("STARTUP_ID")
        .env_remove("XDG_ACTIVATION_TOKEN")
        .output()
        .map_err(|e| format!("Failed to run pkexec: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Installation complete on Linux".into())
}

fn install_macos(bins: Vec<&str>, install_dns: bool, clean: bool, username: &str, config_dir: &str) -> Result<String, String> {
    let mut script = String::new();
    script.push_str("set -e\n");

    if clean {
        script.push_str("rm -f /usr/local/bin/kinetic-daemon /usr/local/bin/kinetic-cli /usr/local/bin/kinetic-dns\n");
        script.push_str("launchctl remove kinetic-daemon || true\n");
        script.push_str("launchctl remove kinetic-dns || true\n");
        script.push_str("rm -f /Library/LaunchDaemons/*kinetic*.plist /Library/LaunchAgents/*kinetic*.plist || true\n");
        script.push_str("sleep 1\n");
        script.push_str(&format!("rm -rf '{}/kinetic'\n", config_dir));
        script.push_str("sleep 1\n");
    }
    
    for bin in bins {
        let url = format!("https://github.com/saifmukhtar/kinetic/releases/latest/download/{}-macos", bin);
        script.push_str(&format!(
            "curl -sL {} -o /tmp/{}\ncp /tmp/{} /usr/local/bin/{}\nchmod +x /usr/local/bin/{}\nrm /tmp/{}\n",
            url, bin, bin, bin, bin, bin
        ));
        
        if bin != "kinetic-cli" {
            if bin == "kinetic-daemon" {
                script.push_str(&format!(
                    "/usr/local/bin/kinetic-daemon install --user {} --config-dir '{}/kinetic'\n/usr/local/bin/kinetic-daemon start-service\n",
                    username, config_dir
                ));
            } else {
                script.push_str(&format!(
                    "/usr/local/bin/{} install\n/usr/local/bin/{} start-service\n",
                    bin, bin
                ));
            }
        }
    }

    script.push_str(&format!("chown -R {} '{}/kinetic'\n", username, config_dir));

    if install_dns {
        script.push_str(
            "mkdir -p /etc/resolver\n\
             echo -e 'nameserver 127.0.0.1\\nport 53' > /etc/resolver/kin\n"
        );
    }

    // Run via osascript
    let output = Command::new("osascript")
        .arg("-e")
        .arg(format!("do shell script \"{}\" with administrator privileges", script.replace("\"", "\\\"")))
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Installation complete on macOS".into())
}

fn install_windows(bins: Vec<&str>, install_dns: bool, clean: bool, username: &str, config_dir: &str) -> Result<String, String> {
    let mut script = String::new();
    script.push_str("$ErrorActionPreference = 'Stop'; $InstallDir = \"$env:ProgramFiles\\Kinetic\"; ");

    if clean {
        script.push_str("Remove-Item -Force $InstallDir\\* -ErrorAction SilentlyContinue; ");
        script.push_str("Stop-Service -Name \"kinetic-daemon\" -ErrorAction SilentlyContinue; ");
        script.push_str("Stop-Service -Name \"kinetic-dns\" -ErrorAction SilentlyContinue; ");
        script.push_str("sc.exe delete \"kinetic-daemon\" | Out-Null; ");
        script.push_str("sc.exe delete \"kinetic-dns\" | Out-Null; ");
        script.push_str("Start-Sleep -Seconds 1; ");
        script.push_str(&format!("Remove-Item -Recurse -Force \"{}\\kinetic\" -ErrorAction SilentlyContinue; ", config_dir));
        script.push_str("Start-Sleep -Seconds 1; ");
    }
    
    script.push_str("if (!(Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir | Out-Null }; ");
    
    for bin in bins {
        let url = format!("https://github.com/saifmukhtar/kinetic/releases/latest/download/{}-windows.exe", bin);
        script.push_str(&format!(
            "Invoke-WebRequest -Uri {} -OutFile $InstallDir\\{}.exe; ",
            url, bin
        ));
        
        if bin != "kinetic-cli" {
            if bin == "kinetic-daemon" {
                script.push_str(&format!(
                    "& $InstallDir\\{}.exe install --user {} --config-dir \"{}\\kinetic\"; ",
                    bin, username, config_dir
                ));
                script.push_str(&format!("& $InstallDir\\{}.exe start-service; ", bin));
            } else {
                script.push_str(&format!(
                    "& $InstallDir\\{}.exe install; ",
                    bin
                ));
                script.push_str(&format!("& $InstallDir\\{}.exe start-service; ", bin));
            }
        }
    }

    script.push_str(
        "$OldPath = [Environment]::GetEnvironmentVariable('Path', [EnvironmentVariableTarget]::Machine); \
         if ($OldPath -notmatch [regex]::Escape($InstallDir)) { \
             [Environment]::SetEnvironmentVariable('Path', \"$OldPath;$InstallDir\", [EnvironmentVariableTarget]::Machine); \
         }; "
    );

    if install_dns {
        script.push_str(
            "Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq '.kin' } | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue; \
             Add-DnsClientNrptRule -Namespace '.kin' -NameServers '127.0.0.1'; "
        );
    }

    // Wrap in a scriptblock encoded as base64 to avoid quotes hell in powershell -Command
    let utf16: Vec<u16> = script.encode_utf16().collect();
    let mut bytes = Vec::new();
    for c in utf16 {
        bytes.push((c & 0xff) as u8);
        bytes.push((c >> 8) as u8);
    }
    
    // We can't easily do base64 in std without crates, so let's just pass it via -Command carefully
    // RunAs is used to request UAC prompt
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("Start-Process powershell -Verb RunAs -ArgumentList \"-NoProfile -Command \\\"{}\\\"\"", script.replace("\"", "'"))
        ])
        .output()
        .map_err(|e| format!("Failed to run powershell: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Installation complete on Windows".into())
}

/// One-click installer for any Atlas-registered fork network.
///
/// # Arguments
/// * `tld`                — The fork's TLD (e.g. "uni"), used to name the install dir and service.
/// * `daemon_name`        — The binary base name (e.g. "uni-daemon"). Will have OS suffix appended.
/// * `binary_download_url`— Base GitHub releases URL (e.g. "https://github.com/uni-network/uni/releases/latest/download").
///
/// The function detects the current OS and, on Linux, whether glibc or musl is available,
/// then downloads `{daemon_name}-{os_suffix}` from `{binary_download_url}/{daemon_name}-{os_suffix}`.
/// The binary is installed to `~/.local/share/{tld}/{daemon_name}` (no root required on Linux).
/// A user-level systemd service named `{tld}-daemon` is created and enabled.
#[command]
pub async fn install_fork_daemon(
    tld: String,
    daemon_name: String,
    binary_download_url: String,
) -> Result<String, String> {
    let os = env::consts::OS;

    // Determine install dir: ~/.local/share/{tld}/
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".into());
    let install_dir = format!("{}/.local/share/{}", home, tld);

    match os {
        "linux" => install_fork_linux(&tld, &daemon_name, &binary_download_url, &install_dir, &home),
        "macos" => install_fork_macos(&tld, &daemon_name, &binary_download_url, &install_dir),
        "windows" => install_fork_windows(&tld, &daemon_name, &binary_download_url),
        _ => Err(format!("Unsupported OS: {}", os)),
    }
}

/// Detect whether the current Linux system uses musl or glibc.
/// Falls back to gnu if detection fails.
fn detect_linux_libc() -> &'static str {
    // ldd --version output contains "musl" on Alpine/musl systems
    if let Ok(out) = Command::new("ldd").arg("--version").output() {
        let text = String::from_utf8_lossy(&out.stdout).to_lowercase()
            + &String::from_utf8_lossy(&out.stderr).to_lowercase();
        if text.contains("musl") {
            return "linux-musl";
        }
    }
    "linux-gnu"
}

fn install_fork_linux(
    tld: &str,
    daemon_name: &str,
    base_url: &str,
    install_dir: &str,
    home: &str,
) -> Result<String, String> {
    let libc = detect_linux_libc();
    let suffix = libc; // "linux-gnu" or "linux-musl"
    let remote_name = format!("{}-{}", daemon_name, suffix);
    let url = format!("{}/{}", base_url.trim_end_matches('/'), remote_name);
    let bin_path = format!("{}/{}", install_dir, daemon_name);

    let mut script = String::from("set -e\n");
    script.push_str(&format!("mkdir -p '{}'\n", install_dir));
    script.push_str(&format!(
        "echo 'Downloading {} from {}...'\ncurl -fsSL '{}' -o '{}'\nchmod +x '{}'\n",
        daemon_name, url, url, bin_path, bin_path
    ));

    // Create a user-level systemd service (no root needed)
    let service_dir = format!("{}/.config/systemd/user", home);
    let service_name = format!("{}-daemon.service", tld);
    let service_path = format!("{}/{}", service_dir, service_name);
    let service_content = format!(
        "[Unit]\nDescription={} network daemon\nAfter=network.target\n\n\
         [Service]\nExecStart={}\nRestart=on-failure\nRestartSec=5\n\n\
         [Install]\nWantedBy=default.target\n",
        tld, bin_path
    );

    script.push_str(&format!("mkdir -p '{}'\n", service_dir));
    script.push_str(&format!("cat > '{}' << 'SVCEOF'\n{}\nSVCEOF\n", service_path, service_content));
    script.push_str("systemctl --user daemon-reload\n");
    script.push_str(&format!("systemctl --user enable '{}'\n", service_name));
    script.push_str(&format!("systemctl --user start '{}' || true\n", service_name));

    let output = Command::new("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run install script: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Install failed:\n{}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(format!(
        "Installed {} to {}. Service {}-daemon started.",
        daemon_name, install_dir, tld
    ))
}

fn install_fork_macos(
    tld: &str,
    daemon_name: &str,
    base_url: &str,
    install_dir: &str,
) -> Result<String, String> {
    let remote_name = format!("{}-macos", daemon_name);
    let url = format!("{}/{}", base_url.trim_end_matches('/'), remote_name);
    let bin_path = format!("{}/{}", install_dir, daemon_name);

    let script = format!(
        "set -e\nmkdir -p '{}'\ncurl -fsSL '{}' -o '{}'\nchmod +x '{}'",
        install_dir, url, bin_path, bin_path
    );

    let output = Command::new("bash")
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to run install script: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Installed {} to {}.", daemon_name, install_dir))
}

fn install_fork_windows(
    tld: &str,
    daemon_name: &str,
    base_url: &str,
) -> Result<String, String> {
    let remote_name = format!("{}-windows.exe", daemon_name);
    let url = format!("{}/{}", base_url.trim_end_matches('/'), remote_name);
    let install_dir = format!("$env:LOCALAPPDATA\\Kinetic\\{}", tld);
    let bin_path = format!("{}\\{}.exe", install_dir, daemon_name);

    let script = format!(
        "if (!(Test-Path '{0}')) {{ New-Item -ItemType Directory -Path '{0}' | Out-Null }}; \
         Invoke-WebRequest -Uri '{1}' -OutFile '{2}'",
        install_dir, url, bin_path
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| format!("Failed to run powershell: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Installed {} for {} network.", daemon_name, tld))
}

