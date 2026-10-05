// Owner contract: 00 Navigator owns `view` (spec noun `navigator.view`). Consumers: capability view slots.
export type SddCapability = { id: string; version: string; status: 'ready' | 'degraded' | 'unavailable'; reason?: string };

export type SddViewId = 'phase' | 'prompt' | 'review' | 'analyze' | 'artifacts' | 'quality' | 'trace' | 'converge' | 'history' | 'control' | 'prompts';

/** `mode` is additive: 'embed' = capability views are drawn inside the Navigator pane; 'panes' = the documented one-view-at-a-time fallback. */
export type NavigatorView = { isOpen: boolean; activeView: SddViewId | null; mode: 'embed' | 'panes' };

declare module 'claude-code' {
  interface PluginState {
    'sdd-navigator': { view: NavigatorView; capability: SddCapability };
  }
}
