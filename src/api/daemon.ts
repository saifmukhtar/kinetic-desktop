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
  logo?: string;
  local_bind_ip?: string;
  api_port?: number;
  repo?: string;
  binary_download?: string;
}

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  if (isTauri) {
    return await invoke<T>(cmd, args);
  }

  // Fallback for browser preview mode
  if (cmd === 'get_atlas_networks') {
    return [
      {
        version: "1.0",
        network_id: "kinetic-mainnet",
        tld: "kin",
        name: "Kinetic Mainnet",
        desc: "Primary decentralized naming network for Kinetic protocol.",
        local_bind_ip: "127.0.0.1",
        api_port: 16002,
        logo: "https://raw.githubusercontent.com/saifmukhtar/kinetic-atlas/main/logos/kin.png"
      },
      {
        version: "1.0",
        network_id: "sol-fork",
        tld: "sol",
        name: "Solana Naming Network",
        desc: "Community fork bringing Solana TLD resolution to Kinetic.",
        local_bind_ip: "127.0.0.2",
        api_port: 17002
      }
    ] as unknown as T;
  }

  if (cmd === 'sync_atlas') {
    return { status: "ok" } as unknown as T;
  }

  throw new Error(`Tauri environment required for ${cmd} (running in standard browser)`);
}

// ── API calls (all go through safeInvoke wrapper) ─────────────────────────────

export const daemon = {
  // Public
  getApiUrl: (): Promise<string> =>
    safeInvoke("get_api_url"),

  getHealth: (): Promise<HealthStatus> =>
    safeInvoke("get_health"),

  getPeerId: (): Promise<string> =>
    safeInvoke("get_peer_id"),

  getNetworkStatus: (): Promise<NetworkStatus> =>
    safeInvoke("get_network_status"),

  getTime: (): Promise<KineticTime> =>
    safeInvoke("get_time"),

  resolveName: (name: string): Promise<unknown> =>
    safeInvoke("resolve_name", { name }),

  resolveKid: (did: string): Promise<unknown> =>
    safeInvoke("resolve_kid", { did }),

  getZone: (name: string): Promise<DnsZone> =>
    safeInvoke("get_zone", { name }),

  getAtlasNetworks: (): Promise<AtlasNetwork[]> =>
    safeInvoke("get_atlas_networks"),

  // Private — owned names & DNS
  getOwnedNames: (): Promise<string[]> =>
    safeInvoke("get_owned_names"),

  publishZone: (name: string, zoneData: DnsZone): Promise<void> =>
    safeInvoke("publish_zone", { name, zoneData }),

  signAndPublishZone: (name: string): Promise<void> =>
    safeInvoke("sign_and_publish_zone", { name }),

  // Private — VDF
  registerVdf: (request: VdfRegisterRequest): Promise<{ task_id: string; message: string }> =>
    safeInvoke("register_vdf", { request }),

  renewVdf: (request: NameRenewRequest): Promise<{ task_id: string; message: string }> =>
    safeInvoke("renew_vdf", { request }),

  getVdfStatus: (taskId: string): Promise<VdfTaskStatus> =>
    safeInvoke("get_vdf_status", { taskId }),

  deleteVdfTask: (taskId: string): Promise<unknown> =>
    safeInvoke("delete_vdf_task", { taskId }),

  // Private — config
  getConfigInfo: (): Promise<unknown> =>
    safeInvoke("get_config_info"),

  updateConfig: (mode: string): Promise<void> =>
    safeInvoke("update_config", { configPostRequest: { mode } }),

  // Private — atlas
  syncAtlas: (): Promise<unknown> =>
    safeInvoke("sync_atlas"),
};
