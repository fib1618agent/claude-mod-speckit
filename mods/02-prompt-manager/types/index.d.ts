// Owner contract: 02 Prompt Manager owns `promptResolution`. Consumers: 03, 09 (10 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type PromptLayerSource =
  | 'upstream' | 'policy' | 'project-template' | 'global-template' | 'pack-default'
  | 'context' | 'artifacts' | 'arguments' | 'one-time';

export type PromptLayer = {
  source: PromptLayerSource;
  id: string;
  /** Non-cryptographic fingerprint of the layer text; the text itself is never stored here. */
  hash: string;
  version?: string;
};

export type PromptAccess = 'read-only' | 'modifies-files' | 'unknown';

export type PromptResolution = {
  phase: string;
  templateId: string;
  version: string;
  hash: string;
  layers: PromptLayer[];
  /** Additive: whether the phase is read-only or may modify files (template metadata). */
  access: PromptAccess;
  /** Additive: `blocked` when the run must not proceed (missing/malformed template, unknown phase). */
  status: 'resolved' | 'blocked';
  reason?: string;
  /** Additive, SESSION-ONLY and bounded: the composed text handed to 03 for review. Never written to disk or $.store. */
  composed?: string;
  /** Additive: identifies the resolve request, so a consumer ignores a stale resolution. */
  requestId?: string;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-prompt-manager': { promptResolution: PromptResolution; capability: SddCapability };
  }
}
