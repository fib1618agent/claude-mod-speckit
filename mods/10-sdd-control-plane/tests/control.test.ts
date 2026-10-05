import { test, expect } from 'claude-code/testing'
import { deriveControl, deriveNext, formatControl, validateConfigDraft, type ControlInput } from '../hooks/lib/control'
import { parseConfig } from '../hooks/shared/config'

const phase = (current: string | null, next: string | null, status = 'current') => ({ current, next, at: 1, phases: [{ id: 'specify', status: 'complete', evidence: [] }, ...(current ? [{ id: current, status, evidence: [] }] : [])] }) as any
const gate = (status: string, blockers: string[] = []) => ({ phase: 'x', status, display: status, blockers, warnings: [], evidence: [], at: 1 })
const base = (o: Partial<ControlInput> = {}): ControlInput => ({ phase: phase('plan', 'tasks'), review: undefined, analyze: undefined, artifacts: undefined, quality: undefined, trace: undefined, convergence: undefined, history: undefined, at: 1, ...o })

test('nextAction priority: pending review first', () => {
  const n = deriveNext(base({ review: { phase: 'plan', state: 'pending', promptHash: '', requestId: 'r', path: 'command', at: 1 } as any, trace: { status: 'GAPS', gaps: [{}] } as any }))
  expect(n.viewId).toBe('review'); expect(n.owner).toContain('03')
})

test('nextAction: missing/stale Analyze -> request it through ③ (never run directly)', () => {
  const n = deriveNext(base({ phase: phase('implement', null), quality: { gates: { implement: gate('NOT_READY', ['Analyze has not been run']) } } as any }))
  expect(n.viewId).toBe('analyze'); expect(n.text).toContain('/sdd-run analyze'); expect(n.text).toContain('Review Gate')
})

test('nextAction: blocked gate -> ⑥; trace gaps -> ⑦; regression -> ⑧; otherwise run current/next phase', () => {
  expect(deriveNext(base({ quality: { gates: { plan: gate('BLOCKED', ['rejected']) } } as any })).viewId).toBe('quality')
  expect(deriveNext(base({ trace: { status: 'GAPS', gaps: [{}, {}] } as any })).viewId).toBe('trace')
  expect(deriveNext(base({ convergence: { state: 'REGRESSED' } as any })).viewId).toBe('converge')
  expect(deriveNext(base()).text).toContain('/sdd-run plan')
  expect(deriveNext(base({ phase: phase('plan', 'tasks', 'complete') })).text).toContain('/sdd-run tasks')
  expect(deriveNext(base({ phase: phase(null, null) })).text).toContain('Nothing pending')
})

test('aggregate: every field comes from owners; missing owners read as unavailable, never invented', () => {
  const c = deriveControl(base({ phase: undefined }))
  expect(c.summary.phase).toBe('unknown'); expect(c.summary.artifactHealth).toBe('unavailable'); expect(c.summary.traceability).toBe('unavailable'); expect(c.summary.convergence).toBe('unavailable')
  expect(c.summary.analyze).toBe('none'); expect(c.summary.lastAction).toBe('none')
  expect(formatControl(c).join('\n')).toContain('NEXT ACTION')
})

test('aggregate shows stale analysis from artifact hashes and the last history entry', () => {
  const art = { items: [{ id: 'spec', exists: true, hash: 'NEW', mtime: 1, producedBy: 'specify', dependsOn: [], fresh: 'fresh' }], feature: 'f', isSpecKit: true, at: 1 } as any
  const analyze = { at: 1, countsBySeverity: {}, findings: [], truncated: false, artifactHashes: { spec: 'OLD' }, overall: 'READY' } as any
  const c = deriveControl(base({ artifacts: art, analyze, history: { entries: [{ at: 1, kind: 'phase', summary: 'did a thing' }], at: 1 } as any }))
  expect(c.summary.analyze).toBe('READY (stale)'); expect(c.summary.lastAction).toBe('did a thing')
})

test('there is no numeric quality score in the aggregate', () => {
  const c = deriveControl(base({ quality: { gates: { plan: gate('PASS') } } as any }))
  expect(JSON.stringify(c)).not.toMatch(/\d+\s*%/)
})

test('config validation: known namespaced sections only; structure checked, content left to each Mod', () => {
  const ok = 'review:\n  enabled: true\nquality:\n  approvalRequired: implement\n'
  expect(validateConfigDraft(ok, parseConfig(ok))).toBeUndefined()
  const bad = 'surprise:\n  x: 1\n'
  expect(validateConfigDraft(bad, parseConfig(bad))).toContain('unknown section')
  const junk = 'review:\n  enabled: true\nthis is not yaml\n'
  expect(validateConfigDraft(junk, parseConfig(junk))).toContain('not a "section:" header')
})

function env(on: any, answer: string) {
  const state: Record<string, any> = {}; const writes: Record<string, string> = {}; const filled: string[] = []
  on('session.root', async () => ({ value: '/proj' })); on('clock.now', async () => ({ value: 2 }))
  on('fs.exists', async () => ({ value: false }))
  on('fs.write', async (_$: any, e: any) => { writes[e.path] = e.text; return { value: undefined } })
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))
  on('prompt.fill', async (_$: any, e: any) => { filled.push(e.text); return { isFilled: true, text: e.text, cursor: 0 } })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$: any, e: any) => ({ result: { questions: e.questions, answers: { [e.questions[0].question]: answer } } }))
  return { state, writes, filled }
}

test('10 only ever writes its own state (control, capability): no ownership leakage', async ($: any, on: any) => {
  const e = env(on, 'Yes')
  await $.session.start({ cwd: '/proj' })
  const foreign = Object.keys(e.state).filter(k => !k.startsWith('sdd-control-plane.'))
  expect(foreign).toEqual([])
  expect(e.state['sdd-control-plane.control'].nextAction.text).toBeTruthy()
})

test('a configuration draft is captured (not sent) and written only after confirmation', async ($: any, on: any) => {
  const e = env(on, 'No')
  const cap = await $.prompt.submit({ text: '<!-- sdd-config-edit -->\nreview:\n  enabled: false\n', origin: { kind: 'composer' }, wait: false })
  expect(cap.drop).toContain('captured, not sent'); expect(e.writes).toEqual({})
  expect(Object.keys(e.writes)).toEqual([]) // nothing is written until Save is pressed and confirmed
})
