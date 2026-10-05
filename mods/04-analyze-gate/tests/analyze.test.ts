import { test, expect } from 'claude-code/testing'
import { buildResult, formatFindings, isMutating, parseReport, reviewedPhase, staleness } from '../hooks/lib/analyze'

const F = (id: string, severity: string) => ({ id, severity, category: 'coverage', artifact: 'spec', evidence: 'FR-001 has no task', explanation: 'x', recommendation: 'add a task' })
const report = (findings: unknown[], overall = 'overall: NOT_READY') => `Analysis done.\n\`\`\`sdd-findings\n${JSON.stringify(findings)}\n\`\`\`\n${overall}\n`

test('parseReport reads the fenced block and never invents findings', () => {
  const p = parseReport(report([F('A1', 'BLOCKER'), F('A2', 'low')]))
  expect(p.ok).toBe(true)
  if (p.ok) { expect(p.findings.map(f => f.severity)).toEqual(['BLOCKER', 'LOW']); expect(p.overall).toBe('NOT_READY') }
})

test('parseReport fails closed: missing block, bad JSON, unknown severity are errors', () => {
  expect(parseReport('prose only').ok).toBe(false)
  expect(parseReport('```sdd-findings\n{oops\n```').ok).toBe(false)
  expect(parseReport('```sdd-findings\n{"a":1}\n```').ok).toBe(false)
  const bad = parseReport(report([F('A1', 'CATASTROPHIC')]))
  expect(bad.ok).toBe(false)
})

test('buildResult: counts are complete, findings bounded, overall never better than the findings', () => {
  const many = Array.from({ length: 130 }, (_, i) => F('F' + i, 'INFO'))
  const r = buildResult(parseReport(report([F('B', 'BLOCKER'), ...many], 'overall: READY')), { spec: 'h' }, 5)
  expect(r.countsBySeverity.BLOCKER).toBe(1); expect(r.countsBySeverity.INFO).toBe(130)
  expect(r.findings.length).toBe(100); expect(r.truncated).toBe(true)
  expect(r.overall).toBe('BLOCKED') // a model claiming READY cannot override a BLOCKER
})

test('buildResult: unparsable report is UNKNOWN, not READY', () => {
  const r = buildResult(parseReport('nothing'), {}, 1)
  expect(r.overall).toBe('UNKNOWN'); expect(r.findings).toEqual([])
})

test('staleness: hash change, vanished artifact and missing inventory', () => {
  const r = buildResult(parseReport(report([])), { spec: 'a', plan: 'b' }, 1)
  expect(staleness(r, { spec: 'a', plan: 'b' })).toBe('fresh')
  expect(staleness(r, { spec: 'a', plan: 'CHANGED' })).toBe('stale')
  expect(staleness(r, { spec: 'a' })).toBe('stale')
  expect(staleness(r, undefined)).toBe('unknown')
  expect(staleness(undefined, {})).toBe('none')
})

test('read-only guard heuristics (best-effort): blocks writes, allows reads', () => {
  for (const t of ['Write', 'Edit', 'NotebookEdit']) expect(isMutating(t, {})).toBe(true)
  for (const c of ['rm -rf x', 'echo hi > file.txt', 'cat a >> b', 'sed -i s/a/b/ f', 'git commit -m x', 'npm install', 'mkdir d', 'tee out.txt', 'git checkout -b x']) expect(isMutating('Bash', { command: c })).toBe(true)
  for (const c of ['ls -la', 'cat spec.md', 'grep -rn FR- specs', 'git status', 'git diff', 'git log --oneline', 'ls 2>&1', 'cat a 2>/dev/null', '.specify/scripts/bash/check-prerequisites.sh --json']) expect(isMutating('Bash', { command: c })).toBe(false)
  expect(isMutating('Read', {})).toBe(false)
})

test('reviewedPhase reads the header 02 puts on every composed prompt', () => {
  expect(reviewedPhase('# Reviewed SDD execution — phase: analyze\n...')).toBe('analyze')
  expect(reviewedPhase('hello')).toBeUndefined()
})

test('findings are listed most severe first', () => {
  const r = buildResult(parseReport(report([F('L', 'LOW'), F('B', 'BLOCKER')])), {}, 1)
  expect(formatFindings(r).indexOf('BLOCKER')).toBeLessThan(formatFindings(r).indexOf('LOW'))
})
