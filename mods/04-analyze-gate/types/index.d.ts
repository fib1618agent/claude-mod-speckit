// Owner contract: 04 Analyze Gate owns `analyze`. Consumers: 06, 08, 10 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type Severity = 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type AnalyzeFinding = {
  id: string;
  severity: Severity;
  category: string;
  artifact: string;
  evidence: string;
  explanation: string;
  recommendation: string;
};

export type AnalyzeResult = {
  at: number;
  countsBySeverity: Record<Severity, number>;
  /** Bounded: counts are always complete, findings are capped (see `truncated`). */
  findings: AnalyzeFinding[];
  truncated: boolean;
  /** Hashes of the artifacts analyzed (from 05); a difference from the current inventory means the result is stale. */
  artifactHashes: Record<string, string>;
  /** Overall status of the run itself: UNKNOWN when the report could not be parsed. */
  overall: 'READY' | 'NOT_READY' | 'BLOCKED' | 'UNKNOWN';
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-analyze-gate': { analyze: AnalyzeResult; capability: SddCapability };
  }
}
