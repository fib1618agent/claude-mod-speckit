import { phaseOfName } from '../shared/phases'

export const HEADER = (phase: string) => `# Reviewed SDD execution — phase: ${phase}`
export const EDIT_MARKER = (id: string) => `<!-- sdd-review-edit:${id} -->`

// A name counts only if it is `speckit-<phase>` / `speckit.<phase>` AND the phase is in the discovered/configured phase set.
export function phaseOfCommand(name: string, phases: string[]): string | undefined {
  const p = phaseOfName(name)
  return p && phases.includes(p) ? p : undefined
}

// Raw typed text: `/speckit-plan args`.
export function phaseOfText(text: string, phases: string[]): { phase: string; args: string } | undefined {
  const m = /^\s*\/(speckit[-.][a-z][\w-]*)(?:\s+([\s\S]*))?$/i.exec(text)
  const phase = m?.[1] ? phaseOfCommand(m[1].toLowerCase(), phases) : undefined
  return phase ? { phase, args: (m?.[2] ?? '').trim() } : undefined
}

export function ensureHeader(text: string, phase: string): string {
  return text.trimStart().startsWith(HEADER(phase)) ? text : `${HEADER(phase)}\n\n${text}`
}

export function parseEditCopy(text: string): { id: string; body: string } | null {
  const m = /^\s*<!--\s*sdd-review-edit:([\w-]+)\s*-->\s*\n?/.exec(text)
  return m && m[1] ? { id: m[1], body: text.slice(m[0].length) } : null
}

export type GateView = { display: string; status: string; blockers: string[]; warnings: string[] } | undefined

// Run is blocked by BLOCKED or NOT_READY (06 reports configured blockers such as "Analyze has not been run" as NOT_READY).
// A missing 06 or a missing gate never blocks and never approves: the card says "no gate evidence".
export function gateBlock(g: GateView): string | undefined {
  if (!g) return undefined
  if (g.status === 'BLOCKED' || g.status === 'NOT_READY') return `Quality gate ${g.display}: ${g.blockers.join('; ') || 'no reason given'}`
  return undefined
}

export function isHuman(origin: { kind?: string } | undefined): boolean {
  return origin?.kind === 'composer' || origin?.kind === 'bridge'
}

// Display only: blank lines are collapsed so a short pane still shows the actions below the preview. Edit shows the full text.
export function preview(text: string, max = 400): string {
  const t = text.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').trim()
  return t.length <= max ? t : t.slice(0, max) + `\n… [${t.length - max} more characters; use Edit to see all]`
}
