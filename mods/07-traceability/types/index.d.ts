// Owner contract: 07 Traceability owns `trace`. Consumers: 04, 06, 08, 10 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type TraceGapKind =
  | 'uncovered-requirement' | 'requirement-without-acceptance' | 'orphan-task'
  | 'task-without-requirement' | 'test-without-requirement' | 'implementation-without-task';

export type TraceGap = { kind: TraceGapKind; id: string; source?: string; inferred: boolean };

export type TraceCounts = { requirements: number; acceptance: number; tasks: number; tests: number; covered: number };

/** Additive, bounded: one matrix row per requirement id. */
export type TraceRow = { id: string; plan: boolean; acceptance: boolean; tasks: string[]; tests: string[]; implementation: boolean; status: 'covered' | 'gap' };

export type Trace = {
  rows: TraceRow[];
  counts: TraceCounts;
  /** Bounded. */
  gaps: TraceGap[];
  /** NOT_APPLICABLE when the project uses no explicit requirement IDs. */
  status: 'COMPLETE' | 'GAPS' | 'NOT_APPLICABLE';
  at: number;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-traceability': { trace: Trace; capability: SddCapability };
  }
}
