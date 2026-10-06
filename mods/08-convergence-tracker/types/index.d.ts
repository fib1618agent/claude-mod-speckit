// Owner contract: 08 Convergence Tracker owns `convergence`. Consumers: 00, 10 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type ConvergenceState = 'NOT_STARTED' | 'IN_PROGRESS' | 'CONVERGING' | 'CONVERGED' | 'BLOCKED' | 'REGRESSED';

export type ConvergenceException = { id: string; reason: string; scope: string; at: number };

export type Convergence = {
  state: ConvergenceState;
  regressions: string[];
  exceptions: ConvergenceException[];
  /** Additive: the evidence the state was derived from. */
  evidence: {
    requirementsSatisfied: number; requirementsTotal: number; tasksDone: number; tasksTotal: number;
    /** False when Analyze has never produced a result. */
    analysisRan: boolean;
    analysisStale: boolean; blockingFindings: number;
    /** Best-effort observation of test/check runs seen in this session; `unknown` when none was observed. */
    checks: 'passing' | 'failing' | 'unknown';
    /** Tasks marked done whose requirements have no mapped test evidence. */
    doneWithoutEvidence: string[];
  };
  at: number;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-convergence-tracker': { convergence: Convergence; capability: SddCapability };
  }
}
