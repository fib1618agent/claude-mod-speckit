// Owner contract: 01 Phase Tracker owns `phase`. Consumers: 00, 06, 10 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type PhaseStatus = 'complete' | 'current' | 'pending' | 'blocked' | 'failed' | 'unknown';

export type PhaseEntry = {
  id: string;
  status: PhaseStatus;
  /** Artifact ids (from the 05 inventory) that justify the status. */
  evidence: string[];
};

export type Phase = {
  current: string | null;
  next: string | null;
  phases: PhaseEntry[];
  at: number;
  /** Additive: why the phase is unknown (no inventory, not a Spec-Kit project, ...). */
  reason?: string;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-phase-tracker': { phase: Phase; capability: SddCapability };
  }
}
