// Owner contract: 06 Quality Gate owns `quality`. Consumers: 03, 08, 10 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type GateStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'BLOCKED' | 'NOT_READY' | 'NOT_APPLICABLE';
/** What status lines show; PASS->READY, PASS_WITH_WARNINGS->WARNING, no evidence->UNKNOWN. */
export type DisplayStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_READY' | 'NOT_APPLICABLE' | 'UNKNOWN';

export type GateEvidence = { source: 'artifacts' | 'analyze' | 'trace' | 'phase' | 'config'; ref: string; hash?: string };

export type Gate = {
  phase: string;
  status: GateStatus;
  display: DisplayStatus;
  blockers: string[];
  warnings: string[];
  evidence: GateEvidence[];
  at: number;
};

export type Approval = {
  phase: string;
  decision: 'approved' | 'rejected' | 'continued';
  at: number;
  /** Fingerprint of the evidence the decision was given for; a different evidence key invalidates the approval. */
  evidenceKey: string;
};

export type Quality = {
  gates: Record<string, Gate>;
  blockers: string[];
  warnings: string[];
  approval: Record<string, Approval>;
  at: number;
  /** Present ONLY when a score formula is explicitly configured; there is no default score. */
  score?: { value: number; formula: string };
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-quality-gate': { quality: Quality; capability: SddCapability };
  }
}
