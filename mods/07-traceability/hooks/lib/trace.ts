import type { Trace, TraceGap, TraceRow } from '../../types'

export const MAX_GAPS = 100
export const MAX_ROWS = 200
export const DEFAULT_REQ = '\\b(?:FR|NFR)-\\d{2,}\\b'

export type TraceInput = {
  specText: string
  planText: string
  tasksText: string
  tests: { path: string; text: string }[]
  implementation: string[] // relative paths of implementation files to check against task mentions
  reqPattern?: string
  at: number
}

const unique = <T,>(xs: T[]) => [...new Set(xs)]

// Only explicit IDs are linked; no similarity guessing, so every gap is deterministic (inferred = false).
export function analyzeTrace(i: TraceInput): Trace {
  const re = new RegExp(i.reqPattern || DEFAULT_REQ, 'g')
  const ids = (text: string) => unique(text.match(re) ?? [])
  const reqs = ids(i.specText)
  if (!reqs.length) return { rows: [], counts: { requirements: 0, acceptance: 0, tasks: 0, tests: 0, covered: 0 }, gaps: [], status: 'NOT_APPLICABLE', at: i.at }

  const reqSet = new Set(reqs)
  const planIds = new Set(ids(i.planText))
  // Acceptance: lines carrying Given/Then or an AC- id that cite a requirement id explicitly.
  const acceptLines = i.specText.split('\n').filter(l => /\bGiven\b.*\bThen\b|\bAC-\d+/i.test(l))
  const acceptIds = new Set(acceptLines.flatMap(l => ids(l)))
  const usesAcceptRefs = acceptIds.size > 0

  const taskLines = i.tasksText.split('\n').filter(l => /^\s*[-*]\s*\[[ xX]\]/.test(l))
  const taskOf = (line: string) => /\bT\d{2,}\b/.exec(line)?.[0] ?? line.replace(/^\s*[-*]\s*\[[ xX]\]\s*/, '').slice(0, 40)
  const tasksByReq = new Map<string, string[]>()
  const gaps: TraceGap[] = []
  for (const line of taskLines) {
    const tid = taskOf(line)
    const refs = ids(line)
    if (!refs.length) { gaps.push({ kind: 'task-without-requirement', id: tid, source: 'tasks', inferred: false }); continue }
    for (const r of refs) {
      if (!reqSet.has(r)) gaps.push({ kind: 'orphan-task', id: tid, source: `tasks -> ${r} (no such requirement)`, inferred: false })
      else tasksByReq.set(r, [...(tasksByReq.get(r) ?? []), tid])
    }
  }

  const testsByReq = new Map<string, string[]>()
  const anyTestUsesIds = i.tests.some(t => ids(t.text).length > 0)
  for (const t of i.tests) {
    const refs = ids(t.text).filter(r => reqSet.has(r))
    if (!refs.length && anyTestUsesIds) gaps.push({ kind: 'test-without-requirement', id: t.path, source: 'tests', inferred: false })
    for (const r of refs) testsByReq.set(r, [...(testsByReq.get(r) ?? []), t.path])
  }

  const mentioned = i.tasksText
  const implGaps = i.implementation.filter(f => !mentioned.includes(f))
  for (const f of implGaps) gaps.push({ kind: 'implementation-without-task', id: f, source: 'implementation', inferred: false })

  const rows: TraceRow[] = reqs.map(id => {
    const tasks = unique(tasksByReq.get(id) ?? [])
    const acceptance = acceptIds.has(id)
    if (!tasks.length) gaps.push({ kind: 'uncovered-requirement', id, source: 'spec', inferred: false })
    if (usesAcceptRefs && !acceptance) gaps.push({ kind: 'requirement-without-acceptance', id, source: 'spec', inferred: false })
    const gap = !tasks.length || (usesAcceptRefs && !acceptance)
    return { id, plan: planIds.has(id), acceptance, tasks, tests: unique(testsByReq.get(id) ?? []), implementation: tasks.length > 0 && !implGaps.length, status: gap ? 'gap' : 'covered' }
  })

  return {
    rows: rows.slice(0, MAX_ROWS),
    counts: { requirements: reqs.length, acceptance: rows.filter(r => r.acceptance).length, tasks: taskLines.length, tests: rows.filter(r => r.tests.length).length, covered: rows.filter(r => r.tasks.length).length },
    gaps: gaps.slice(0, MAX_GAPS),
    status: gaps.length ? 'GAPS' : 'COMPLETE',
    at: i.at,
  }
}

export function formatTrace(t: Trace): string {
  if (t.status === 'NOT_APPLICABLE') return 'Traceability: NOT_APPLICABLE (no explicit requirement IDs found in the specification).'
  const head = `Traceability: ${t.status}  requirements=${t.counts.requirements} covered=${t.counts.covered} with-tests=${t.counts.tests} tasks=${t.counts.tasks}`
  const rows = t.rows.map(r => `${r.id.padEnd(10)} plan:${r.plan ? 'y' : 'n'} tasks:${r.tasks.join(',') || '-'} tests:${r.tests.length} ${r.status}`)
  const gaps = t.gaps.map(g => `  GAP ${g.kind}: ${g.id}${g.source ? ' (' + g.source + ')' : ''}${g.inferred ? ' [inferred]' : ''}`)
  return [head, ...rows, ...(gaps.length ? ['Gaps:', ...gaps] : [])].join('\n')
}
