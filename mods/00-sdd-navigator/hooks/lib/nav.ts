import type { SddViewId } from '../../types'

export type NavEntry = { key: string; id: SddViewId; label: string; name: string; capability: string }

// Mapping is final per spec 00 §6: 1-9, 0 and p (lowercase). ⑪ is rendered by 02 (the Prompt Pack is content only).
export const NAV: NavEntry[] = [
  { key: '1', id: 'phase', label: '① Phase', name: 'Phase Tracker', capability: 'phase' },
  { key: '2', id: 'prompt', label: '② Prompt', name: 'Prompt Manager', capability: 'prompt' },
  { key: '3', id: 'review', label: '③ Review', name: 'Prompt Review Gate', capability: 'review' },
  { key: '4', id: 'analyze', label: '④ Analyze', name: 'Analyze Gate', capability: 'analyze' },
  { key: '5', id: 'artifacts', label: '⑤ Artifacts', name: 'Artifact Tracker', capability: 'artifacts' },
  { key: '6', id: 'quality', label: '⑥ Quality', name: 'Quality Gate', capability: 'quality' },
  { key: '7', id: 'trace', label: '⑦ Trace', name: 'Requirement Traceability', capability: 'trace' },
  { key: '8', id: 'converge', label: '⑧ Converge', name: 'Convergence Tracker', capability: 'converge' },
  { key: '9', id: 'history', label: '⑨ History', name: 'Session History', capability: 'history' },
  { key: '0', id: 'control', label: '⑩ Control', name: 'SDD Control Plane', capability: 'control' },
  { key: 'p', id: 'prompts', label: '⑪ Prompts', name: 'Prompt Pack catalog (via Prompt Manager)', capability: 'prompt' },
]
export const RESERVED_HOTKEYS = [...NAV.map(n => n.key), 'b']

const ALIASES: Record<string, SddViewId> = { status: 'phase', pack: 'prompts', packs: 'prompts', catalog: 'prompts', convergence: 'converge', traceability: 'trace', artifact: 'artifacts', gate: 'quality' }
export function parseView(arg: string): SddViewId | undefined {
  const a = arg.trim().toLowerCase()
  return NAV.find(n => n.id === a || n.key === a)?.id ?? ALIASES[a]
}

export type Cap = { status: 'ready' | 'degraded' | 'unavailable'; reason?: string } | undefined
export const isUnavailable = (c: Cap) => !c || c.status === 'unavailable'

// Statuses only. A numeric score would be shown only if 06 supplied one (it is never invented here).
export function statusLine(i: { phase?: string; quality?: string; progress?: string; convergence?: string }): string {
  if (!i.phase && !i.convergence) return 'SDD | unavailable'
  const parts = ['SDD', (i.phase && i.phase !== 'unknown' ? i.phase : 'phase ?').toUpperCase()]
  if (i.quality && i.quality !== 'unavailable') parts.push(`Gate ${i.quality}`)
  if (i.progress && i.progress !== '-') parts.push(i.progress)
  if (i.convergence && i.convergence !== 'unavailable') parts.push(`Conv ${i.convergence}`)
  return parts.join(' | ')
}

// Did a capability actually draw into the slot? Views start with "SDD / <NAME>".
export function containsView(tree: unknown): boolean {
  try { return JSON.stringify(tree ?? null).includes('SDD / ') } catch { return false }
}

export function unavailableText(entry: NavEntry, cap: Cap): string[] {
  return [`SDD / ${entry.id.toUpperCase()}`, '', 'Capability unavailable', `${entry.name} is unavailable.`, '', 'Reason:', cap?.reason ?? (cap ? 'it reported itself unavailable' : 'it has not started (not installed, disabled or failed to load)')]
}
