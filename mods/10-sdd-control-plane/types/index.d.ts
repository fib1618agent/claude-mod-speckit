// Owner contract: 10 Control Plane owns `control` (DERIVED aggregate). Consumer: 00 (09 observes).
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type ControlSummary = {
  phase: string;
  nextPhase: string;
  progress: string;
  artifactHealth: string;
  analyze: string;
  traceability: string;
  quality: string;
  convergence: string;
  lastAction: string;
};

/** A recommendation with an owner. 10 never executes it. */
export type NextAction = { text: string; owner: string; viewId: string };

export type Control = { summary: ControlSummary; nextAction: NextAction; at: number };

declare module 'claude-code' {
  interface PluginState {
    'sdd-control-plane': { control: Control; capability: SddCapability };
  }
}
