use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // ── Compute NETWORK_SALT ────────────────────────────────────────────────
    // Mirrors kinetic-core/build.rs:
    //   NETWORK_SALT = SHA-256(network_id_bytes + ROOT_PUBLIC_KEY_HEX_bytes)
    //
    // We read ROOT_PUBLIC_KEY_HEX from kinetic-core/src/constants.rs and
    // network_id from kinetic/network.json in the sibling workspace directory.
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let kinetic_root = PathBuf::from(&manifest_dir)
        .parent() // src-tauri -> kinetic-desktop
        .and_then(|p| p.parent()) // kinetic-desktop -> home/saif
        .map(|p| p.join("kinetic"))
        .expect("Could not resolve kinetic workspace root");

    // Extract the production ROOT_PUBLIC_KEY_HEX from constants.rs
    let constants_src = fs::read_to_string(kinetic_root.join("kinetic-core/src/constants.rs"))
        .expect("build.rs: could not read kinetic-core/src/constants.rs");

    let prod_root_key = extract_root_key(&constants_src, "prod_keys");

    let network_json_src = fs::read_to_string(kinetic_root.join("network.json"))
        .expect("build.rs: could not read kinetic/network.json");
    let network_json: serde_json::Value =
        serde_json::from_str(&network_json_src).expect("build.rs: invalid network.json");

    // Compute the PROD salt (SOVEREIGN_KEY + BEACON_KEY + GENESIS_TIME)
    let beacon_public_key = network_json["beacon"]["beacon_public_key"]
        .as_str()
        .expect("build.rs: network.json missing beacon.beacon_public_key")
        .to_string();

    let beacon_genesis = network_json["beacon"]["beacon_genesis"]
        .as_u64()
        .expect("build.rs: network.json missing beacon.beacon_genesis");

    // Compute SHA-256(SOVEREIGN_KEY + BEACON_KEY + GENESIS_TIME)
    let mut hasher = Sha256::new();
    hasher.update(prod_root_key.as_bytes());
    hasher.update(beacon_public_key.as_bytes());
    hasher.update(beacon_genesis.to_be_bytes());
    let salt = hasher.finalize();

    // Emit as comma-separated byte string for use in api_commands.rs via env!()
    let salt_bytes: Vec<String> = salt.iter().map(|b| b.to_string()).collect();
    println!("cargo:rustc-env=KINETIC_NETWORK_SALT={}", salt_bytes.join(","));

    // Re-run if either source file changes
    println!(
        "cargo:rerun-if-changed={}",
        kinetic_root.join("kinetic-core/src/constants.rs").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        kinetic_root.join("network.json").display()
    );
}

fn extract_root_key(src: &str, module_name: &str) -> String {
    let mod_marker = format!("pub mod {}", module_name);
    let mod_start = src
        .find(&mod_marker)
        .unwrap_or_else(|| panic!("build.rs: could not find `{}` in constants.rs", module_name));

    let key_marker = "pub const SOVEREIGN_KEY_HEX: &str = \"";
    let key_start = src[mod_start..]
        .find(key_marker)
        .unwrap_or_else(|| panic!("build.rs: SOVEREIGN_KEY_HEX missing in {}", module_name))
        + mod_start
        + key_marker.len();

    let key_end = src[key_start..]
        .find('"')
        .unwrap_or_else(|| panic!("build.rs: malformed SOVEREIGN_KEY_HEX in {}", module_name))
        + key_start;

    src[key_start..key_end].to_string()
}
