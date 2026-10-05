import type { AnalyzeFinding, AnalyzeResult, Severity } from '../../types'
import { evidenceFreshness } from '../shared/evidence'

export const SEVERITIES: Severity[] = ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
export const MAX_FINDINGS = 100
export const REVIEW_PLUGIN = 'sdd-prompt-review'

export const emptyCounts = (): Record<Severity, number> => ({ BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 })

// The header `02` puts on every composed prompt; `03` guarantees it survives user edits.
export function reviewedPhase(text: string): string | undefined {
  return /^# Reviewed SDD execution — phase: ([a-z][a-z0-9-]*)/.exec(text.trimStart())?.[1]
}

export type Parsed = { ok: true; findings: AnalyzeFinding[]; overall?: AnalyzeResult['overall'] } | { ok: false; error: string }

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

// Reads the fenced ```sdd-findings JSON block the Analyze template requires. Never invents findings.
export function parseReport(text: string): Parsed {
  const m = /```sdd-findings\s*([\s\S]*?)```/.exec(text)
  if (!m) return { ok: false, error: 'no sdd-findings block in the report' }
  let raw: unknown
  try { raw = JSON.parse(m[1] ?? '') } catch { return { ok: false, error: 'sdd-findings block is not valid JSON' } }
  if (!Array.isArray(raw)) return { ok: false, error: 'sdd-findings block is not a JSON array' }
  const findings: AnalyzeFinding[] = []
  for (const f of raw) {
    const o = (f ?? {}) as Record<string, unknown>
    const sev = str(o.severity).toUpperCase() as Severity
    if (!SEVERITIES.includes(sev)) return { ok: false, error: `finding ${str(o.id) || '?'} has unknown severity "${str(o.severity)}"` }
    findings.push({ id: str(o.id), severity: sev, category: str(o.category), artifact: str(o.artifact), evidence: str(o.evidence), explanation: str(o.explanation), recommendation: str(o.recommendation) })
  }
  const ov = /^\s*overall:\s*(READY|NOT_READY|BLOCKED)\b/im.exec(text.slice(m.index + m[0].length))?.[1] as AnalyzeResult['overall'] | undefined
  return { ok: true, findings, overall: ov }
}

export function buildResult(parsed: Parsed, hashes: Record<string, string>, at: number): AnalyzeResult {
  if (!parsed.ok) return { at, countsBySeverity: emptyCounts(), findings: [], truncated: false, artifactHashes: hashes, overall: 'UNKNOWN' }
  const counts = emptyCounts()
  for (const f of parsed.findings) counts[f.severity]++
  // The reported overall status can never be better than the findings it sits beside.
  const derived: AnalyzeResult['overall'] = counts.BLOCKER ? 'BLOCKED' : counts.HIGH ? 'NOT_READY' : 'READY'
  const rank = { READY: 0, NOT_READY: 1, BLOCKED: 2, UNKNOWN: 3 } as const
  const overall = parsed.overall && rank[parsed.overall] >= rank[derived] ? parsed.overall : derived
  return { at, countsBySeverity: counts, findings: parsed.findings.slice(0, MAX_FINDINGS), truncated: parsed.findings.length > MAX_FINDINGS, artifactHashes: hashes, overall }
}

// Stale = any analyzed artifact's hash differs from (or has vanished from) the current inventory. Unknown inventory => unknown.
export function staleness(result: AnalyzeResult | undefined, current: Record<string, string> | undefined): 'fresh' | 'stale' | 'unknown' | 'none' {
  if (!result) return 'none'
  return evidenceFreshness(result.artifactHashes, current)
}

const MUTATING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
// Best-effort heuristics. NOT a security boundary: a determined command can evade them.
const BASH_MUTATING = [
  /(^|[;&|]\s*|\s)(rm|rmdir|mv|cp|mkdir|touch|chmod|chown|ln|truncate|dd|tee|install|patch)\b/,
  /\bsed\b[^|;&]*\s-i/, /\bperl\b[^|;&]*\s-i/,
  /\bgit\s+(add|commit|checkout|switch|reset|restore|apply|am|rebase|merge|cherry-pick|push|pull|stash|clean|rm|mv|tag|branch\s+-[dD])\b/,
  /\b(npm|pnpm|yarn|bun)\s+(i|install|add|remove|uninstall|update|run\s+build)\b/, /\bpip3?\s+(install|uninstall)\b/,
]
export function isMutating(tool: string, input: { command?: string }): boolean {
  if (MUTATING_TOOLS.has(tool)) return true
  if (tool !== 'Bash') return false
  const cmd = (input.command ?? '').replace(/\d*>\s*&\s*\d+/g, '').replace(/\d*>\s*\/dev\/null/g, '')
  return /(^|[^<>=!-])>>?(?!=)/.test(cmd) || BASH_MUTATING.some(re => re.test(cmd))
}

export function formatResult(r: AnalyzeResult | undefined, stale: ReturnType<typeof staleness>): string {
  if (!r) return 'No analysis available. Run it with /sdd-analyze run (goes through the Review Gate).'
  const c = r.countsBySeverity
  const head = `Analyze: ${r.overall}${stale === 'stale' ? ' (STALE: artifacts changed since)' : stale === 'unknown' ? ' (staleness unknown)' : ''}\nBLOCKER ${c.BLOCKER}  HIGH ${c.HIGH}  MEDIUM ${c.MEDIUM}  LOW ${c.LOW}  INFO ${c.INFO}${r.truncated ? '  (findings truncated)' : ''}`
  return head
}

export function formatFindings(r: AnalyzeResult | undefined, limit = 15): string {
  if (!r || !r.findings.length) return 'No findings recorded.'
  const order = (s: Severity) => SEVERITIES.indexOf(s)
  return [...r.findings].sort((a, b) => order(a.severity) - order(b.severity)).slice(0, limit)
    .map(f => `${f.severity.padEnd(7)} ${f.id}  [${f.category}] ${f.artifact}\n          ${f.explanation}\n          -> ${f.recommendation}`).join('\n')
}
