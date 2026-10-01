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

export interface NrsRecord {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "PeerId" | "KID";
  value: string;
}

export interface NrsZone {
  records: Record<string, NrsRecord[]>;
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

export interface LocalKidSummary {
  name: string;
  did: string;
  created_at: number;
  doc_path?: string;
  has_key?: boolean;
  deactivated?: boolean;
}

export interface ControllerKey {
  id: string;
  key_type: string;
  public_key: string;
  created_at?: number;
  revoked?: boolean;
}

export interface KidDocument {
  kid: string;
  controller_keys: ControllerKey[];
  created_at: number;
  network_id?: string;
  version?: number;
  name?: string;
  [key: string]: unknown;
}

export interface KidDetailResponse {
  name: string;
  kid_doc: KidDocument;
  path?: string;
}

export interface KidGenerateResponse {
  success: boolean;
  name: string;
  did: string;
  is_inherited?: boolean;
  kid_doc: KidDocument;
}

export interface KidRotateResponse {
  success: boolean;
  name: string;
  did: string;
  kid_doc: KidDocument;
}

export interface KidRevokeResponse {
  success: boolean;
  name: string;
  did: string;
  deactivated: boolean;
  kid_doc: KidDocument;
}

export interface ServiceEntry {
  id: string;
  type: string;
  protocol: string;
  endpoint: string;
}

export interface CapabilityManifest {
  type?: string;
  kid: string;
  version: number;
  valid_from: number;
  expires_at?: number;
  services: ServiceEntry[];
  signature?: string;
}

export interface KidManifestResponse {
  name: string;
  manifest: CapabilityManifest | null;
}

export interface KidUpdateManifestResponse {
  success: boolean;
  name: string;
  manifest: CapabilityManifest;
}


async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  if (isTauri) {
    return await invoke<T>(cmd, args);
  }

  // Fallback removed per user request: strictly enforce Tauri environment
  throw new Error(`Tauri environment required for ${cmd} (running in standard browser)`);
}

// ── API calls (all go through safeInvoke wrapper) ─────────────────────────────

export const daemon = {
  // Public
  getApiUrl: (): Promise<string> =>
    safeInvoke("get_api_url"),

  setActiveEndpoint: (ip: string, port: number, networkId: string): Promise<void> =>
    safeInvoke("set_active_endpoint", { ip, port, networkId }),

  getActiveEndpoint: (): Promise<{ url: string; network_id: string }> =>
    safeInvoke("get_active_endpoint"),

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

  getZone: (name: string): Promise<NrsZone> =>
    safeInvoke("get_zone", { name }),

  // Private — owned names & DNS
  getOwnedNames: (): Promise<string[]> =>
    safeInvoke("get_owned_names"),

  publishZone: (name: string, zoneData: NrsZone): Promise<void> =>
    safeInvoke("publish_zone", { name, zoneData }),

  signAndPublishZone: (name: string): Promise<void> =>
    safeInvoke("sign_and_publish_zone", { name }),

  publishKid: (authorizedKid: unknown): Promise<unknown> =>
    safeInvoke("publish_kid", { authorizedKid }),

  publishManifest: (authorizedManifest: unknown): Promise<unknown> =>
    safeInvoke("publish_manifest", { authorizedManifest }),

  // Private — Local KID management
  getKids: (): Promise<{ kids: LocalKidSummary[] }> =>
    safeInvoke("get_local_kids"),

  getKid: (name: string): Promise<KidDetailResponse> =>
    safeInvoke("get_local_kid", { name }),

  generateSubnameKid: (
    baseName: string,
    subName?: string,
    inheritSubname: boolean = true,
    force: boolean = false
  ): Promise<KidGenerateResponse> =>
    safeInvoke("generate_kid", {
      baseName,
      subName: subName || null,
      inheritSubname,
      force,
    }),

  rotateKid: (name: string): Promise<KidRotateResponse> =>
    safeInvoke("rotate_kid", { name }),

  revokeKid: (name: string): Promise<KidRevokeResponse> =>
    safeInvoke("revoke_kid", { name }),

  getKidManifest: (name: string): Promise<KidManifestResponse> =>
    safeInvoke("get_kid_manifest", { name }),

  updateKidManifest: (name: string, services: ServiceEntry[]): Promise<KidUpdateManifestResponse> =>
    safeInvoke("update_kid_manifest", { name, services }),

  // Private — VDF
  registerVdf: (request: VdfRegisterRequest): Promise<{ task_id: string; message: string }> =>
    safeInvoke("register_vdf", { request }),

  renewVdf: (request: NameRenewRequest): Promise<{ task_id: string; message: string }> =>
    safeInvoke("renew_vdf", { request }),

  getVdfStatus: (taskId: string): Promise<VdfTaskStatus> =>
    safeInvoke("get_vdf_status", { taskId }),

  deleteVdfTask: (taskId: string): Promise<void> =>
    safeInvoke("delete_vdf_task", { taskId }),

  // Private — Installer
  checkInstalled: (networkId: string): Promise<{ is_installed: boolean; install_type: string | null }> =>
    safeInvoke("check_installed", { networkId }),

  downloadBinaries: (networkId: string, installType: string, baseUrl: string): Promise<string> =>
    safeInvoke("download_binaries", { networkId, installType, baseUrl }),

  installBinaries: (networkId: string, installType: string): Promise<string> =>
    safeInvoke("install_binaries", { networkId, installType }),

  // Private — config
  getConfigInfo: (): Promise<unknown> =>
    safeInvoke("get_config_info"),

  updateConfig: (mode: string): Promise<void> =>
    safeInvoke("update_config", { mode }),

  getDaemonConfig: (): Promise<any> =>
    safeInvoke("get_daemon_config"),

  setDaemonConfig: (config_data: any): Promise<any> =>
    safeInvoke("set_daemon_config", { configData: config_data }),
  // ---------------------------------------------------------------------------
  // IDENTITY / NODE SEED
  // ---------------------------------------------------------------------------

  async checkIdentityStatus(): Promise<{ status: 'found' | 'not_found' | 'corrupted', detail?: string }> {
    return safeInvoke<{ status: 'found' | 'not_found' | 'corrupted', detail?: string }>('check_identity_status');
  },

  async generateSeedPhrase(): Promise<{ phrase: string; verify_index_1: number; verify_index_2: number }> {
    return safeInvoke<{ phrase: string; verify_index_1: number; verify_index_2: number }>('generate_seed_phrase');
  },

  async saveSeedPhrase(phrase: string): Promise<{ success: boolean }> {
    return safeInvoke<{ success: boolean }>('save_seed_phrase', { phrase });
  },

  // ---------------------------------------------------------------------------
  // OS PAC PROXY ROUTING
  // ---------------------------------------------------------------------------

  async listProxyRules(): Promise<Array<{ filename: string, nsp: string, proxy_ip: string, proxy_port: number, is_custom: boolean }>> {
    return safeInvoke('list_proxy_rules');
  },

  async addCustomProxy(nsp: string, ip: string, port: number): Promise<void> {
    return safeInvoke('add_custom_proxy', { nsp, ip, port });
  },

  async removeCustomProxy(filename: string): Promise<void> {
    return safeInvoke('remove_custom_proxy', { filename });
  },

  // ---------------------------------------------------------------------------
  // LOCAL ZONES (Private Overrides)
  // ---------------------------------------------------------------------------

  async getReservedNames(): Promise<Array<{ name: string; active: boolean }>> {
    return safeInvoke('get_reserved_names');
  },

  async getLocalReservedZone(name: string): Promise<NrsZone | null> {
    return safeInvoke('get_local_reserved_zone', { name });
  },

  async saveLocalReservedZone(name: string, records: Record<string, NrsRecord[]>): Promise<void> {
    return safeInvoke('save_local_reserved_zone', { name, records });
  },

  async deleteLocalReservedZone(name: string): Promise<void> {
    return safeInvoke('delete_local_reserved_zone', { name });
  }
};
