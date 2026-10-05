// Owner contract: 09 Session History owns `history`. Consumers: 00, 10.
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type HistoryKind = 'phase' | 'review' | 'analyze' | 'artifacts' | 'quality' | 'trace' | 'convergence';

/** Bounded metadata only: never prompts, secrets or source files. */
export type HistoryEntry = {
  at: number;
  kind: HistoryKind;
  phase?: string;
  summary: string;
  templateId?: string;
  version?: string;
  /** Fingerprint, so the prompt used is reproducible without storing it. */
  promptHash?: string;
  overridden?: boolean;
  sessionId?: string;
};

export type History = { entries: HistoryEntry[]; at: number };

declare module 'claude-code' {
  interface PluginState {
    'sdd-session-history': { history: History; capability: SddCapability };
  }
}
