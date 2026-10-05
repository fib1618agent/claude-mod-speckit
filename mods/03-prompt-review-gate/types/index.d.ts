// Owner contract: 03 Prompt Review Gate owns `review`. Consumers: 09, 10. (06 deliberately does NOT read it: avoids a 03 <-> 06 state cycle.)
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type ReviewState = 'pending' | 'approved' | 'cancelled';
export type InterceptionPath = 'command' | 'prompt' | 'tool' | 'sdd-run';

export type Review = {
  phase: string;
  /** Fingerprint of the exact text that was (or is to be) run; the prompt text itself is never stored. */
  promptHash: string;
  state: ReviewState;
  /** Additive. */
  requestId: string;
  path: InterceptionPath;
  at: number;
  reason?: string;
  /** True when the user edited the execution copy before approving. */
  edited?: boolean;
};

declare module 'claude-code' {
  interface PluginState {
    'sdd-prompt-review': { review: Review; capability: SddCapability };
  }
}
