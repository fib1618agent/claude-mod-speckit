// Owner contract: 05 Artifact Tracker owns the `artifacts` noun. Consumers: 01, 06, 07, 08, 10 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type ArtifactFreshness = 'fresh' | 'stale' | 'unknown';

export type ArtifactItem = {
  id: string;
  exists: boolean;
  /** Content fingerprint (non-cryptographic); empty when the artifact is missing or unreadable. */
  hash: string;
  /** Modification time, ms since epoch; 0 when missing. */
  mtime: number;
  producedBy: string;
  dependsOn: string[];
  fresh: ArtifactFreshness;
  /** Additive metadata allowed by the amended spec. */
  path?: string;
  size?: number;
  status?: 'present' | 'missing' | 'unreadable';
  /** True when the hash differs from the previous scan of this project. */
  changed?: boolean;
};

export type Artifacts = { items: ArtifactItem[]; feature: string | null; isSpecKit: boolean; at: number };

declare module 'claude-code' {
  interface PluginState {
    'sdd-artifact-tracker': { artifacts: Artifacts; capability: SddCapability };
  }
}
