// The phase model: configured (phase.model) or discovered from the installed Spec-Kit commands/skills, never hard-coded per Mod.
export const CANONICAL_PHASES = ['constitution', 'specify', 'clarify', 'plan', 'checklist', 'tasks', 'analyze', 'implement', 'converge'] as const

// Names such as `speckit-plan`, `speckit.plan` or `speckit.plan.md` -> `plan`.
export function phaseOfName(name: string): string | undefined {
  const m = /^speckit[-.]([a-z][\w-]*?)(?:\.md)?$/i.exec(name)
  return m && m[1] ? m[1].toLowerCase() : undefined
}

export function resolvePhaseModel(configured: string[], discoveredNames: string[]): string[] {
  if (configured.length) return configured
  const found = new Set<string>()
  for (const n of discoveredNames) { const p = phaseOfName(n); if (p) found.add(p) }
  if (!found.size) return [...CANONICAL_PHASES]
  const known = CANONICAL_PHASES.filter(p => found.has(p))
  const extra = [...found].filter(p => !(CANONICAL_PHASES as readonly string[]).includes(p)).sort()
  return [...known, ...extra]
}
