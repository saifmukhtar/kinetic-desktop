import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status?: string;
  uptime_seconds?: number;
  version?: string;
  [key: string]: unknown;
}

export interface NetworkStatus {
  peer_count?: number;
  mode?: string;
  drand_pulse?: number;
  connected?: boolean;
  [key: string]: unknown;
}

export interface VdfTaskStatus {
  status: string;
  iterations: number;
  progress: number;
  error?: string | null;
}

export interface DnsRecord {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "PeerId" | "KID";
  value: string;
}

export interface DnsZone {
  records: Record<string, DnsRecord[]>;
}

export interface VdfRegisterRequest {
  name: string;
  iterations?: number | null;
}

export interface NameRenewRequest {
  name: string;
  iterations?: number | null;
}

export interface KineticTime {
  drand_pulse?: number;
  timestamp?: number;
  [key: string]: unknown;
}

export interface AtlasNetwork {
  version?: string;
  network_id?: string;
  tld: string;
  name?: string;
  desc?: string;
  seed_domain?: string;
  local_bind_ip?: string;
  bootstrap_nodes?: string[];
  binary_download?: string;
  logo?: string;
  ipfs_gateway?: string;
}

// ── API calls (all go through Tauri invoke) ──────────────────────────────────

export const daemon = {
  // Public
  getHealth: (): Promise<HealthStatus> =>
    invoke("get_health"),

  getPeerId: (): Promise<string> =>
    invoke("get_peer_id"),

  getNetworkStatus: (): Promise<NetworkStatus> =>
    invoke("get_network_status"),

  getTime: (): Promise<KineticTime> =>
    invoke("get_time"),

  resolveName: (name: string): Promise<unknown> =>
    invoke("resolve_name", { name }),

  resolveKid: (did: string): Promise<unknown> =>
    invoke("resolve_kid", { did }),

  getZone: (name: string): Promise<DnsZone> =>
    invoke("get_zone", { name }),

  getAtlasNetworks: (): Promise<AtlasNetwork[]> =>
    invoke("get_atlas_networks"),

  // Private — owned names & DNS
  getOwnedNames: (): Promise<string[]> =>
    invoke("get_owned_names"),

  publishZone: (name: string, zoneData: DnsZone): Promise<void> =>
    invoke("publish_zone", { name, zoneData }),

  signAndPublishZone: (name: string): Promise<void> =>
    invoke("sign_and_publish_zone", { name }),

  // Private — VDF
  registerVdf: (request: VdfRegisterRequest): Promise<{ task_id: string; message: string }> =>
    invoke("register_vdf", { request }),

  renewVdf: (request: NameRenewRequest): Promise<{ task_id: string; message: string }> =>
    invoke("renew_vdf", { request }),

  getVdfStatus: (taskId: string): Promise<VdfTaskStatus> =>
    invoke("get_vdf_status", { taskId }),

  deleteVdfTask: (taskId: string): Promise<unknown> =>
    invoke("delete_vdf_task", { taskId }),

  // Private — config
  getConfigInfo: (): Promise<unknown> =>
    invoke("get_config_info"),

  updateConfig: (mode: string): Promise<void> =>
    invoke("update_config", { configPostRequest: { mode } }),

  // Private — atlas
  syncAtlas: (): Promise<unknown> =>
    invoke("sync_atlas"),

  installForkDaemon: (tld: string, daemonName: string, binaryDownloadUrl: string): Promise<string> =>
    invoke("install_fork_daemon", { tld, daemonName, binaryDownloadUrl }),
};
