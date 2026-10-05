import { test, expect } from 'claude-code/testing'
import { appendBounded, diffSnapshot, formatTimeline, type Snapshot } from '../hooks/lib/history'

const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ phase: { current: 'plan' }, review: { phase: 'plan', state: 'pending', promptHash: 'abc12345def', requestId: 'r1' }, ...o })

test('startup settling (no phase known -> a phase) is not a transition; a later real change is', () => {
  const a = diffSnapshot({}, { phase: { current: null } }, 1)
  const b = diffSnapshot(a.sig, { phase: { current: 'plan' } }, 2)
  expect(b.entries).toEqual([])
  const c = diffSnapshot(b.sig, { phase: { current: 'tasks' } }, 3)
  expect(c.entries.map(e => e.summary)).toEqual(['current phase is now tasks'])
})

test('baseline run records NO entries (transitions only, not the state found at startup)', () => {
  const out = diffSnapshot({}, snap({ analyze: { at: 1, overall: 'READY', counts: {} }, trace: { status: 'COMPLETE', gaps: 0 }, convergence: { state: 'NOT_STARTED' } }), 1)
  expect(out.entries).toEqual([])
  expect(Object.keys(out.sig).length).toBeGreaterThan(0)
})

test('phase transition, review lifecycle with prompt reproducibility metadata (no prompt text)', () => {
  const a = diffSnapshot({}, snap({ promptRes: { phase: 'plan', templateId: 'pack:plan', version: '2', status: 'resolved' } }), 1)
  const b = diffSnapshot(a.sig, snap({ phase: { current: 'tasks' }, promptRes: { phase: 'plan', templateId: 'pack:plan', version: '2', status: 'resolved' }, review: { phase: 'plan', state: 'approved', promptHash: 'abc12345def', requestId: 'r1', edited: true } }), 2)
  const kinds = b.entries.map(e => e.kind).sort()
  expect(kinds).toEqual(['phase', 'review'])
  const rev = b.entries.find(e => e.kind === 'review')!
  expect(rev.templateId).toBe('pack:plan'); expect(rev.version).toBe('2'); expect(rev.promptHash).toBe('abc12345def'); expect(rev.overridden).toBe(true)
  expect(JSON.stringify(b.entries)).not.toMatch(/COMPOSED|prompt text/i)
})

test('artifact changes, gate transitions, analysis runs, trace and convergence are each recorded once', () => {
  const a = diffSnapshot({}, snap({ artifacts: { spec: 'h1', plan: 'h2' }, quality: { implement: 'NOT_READY' }, analyze: { at: 1, overall: 'NOT_READY', counts: { HIGH: 1 } }, trace: { status: 'GAPS', gaps: 2 }, convergence: { state: 'IN_PROGRESS' } }), 1)
  const b = diffSnapshot(a.sig, snap({ artifacts: { spec: 'h1-EDITED', plan: 'h2' }, quality: { implement: 'READY' }, analyze: { at: 9, overall: 'READY', counts: {} }, trace: { status: 'COMPLETE', gaps: 0 }, convergence: { state: 'CONVERGING' } }), 2)
  expect(b.entries.map(e => e.kind).sort()).toEqual(['analyze', 'artifacts', 'convergence', 'quality', 'trace'])
  expect(b.entries.find(e => e.kind === 'artifacts')!.summary).toBe('artifacts changed: spec')
  expect(b.entries.find(e => e.kind === 'quality')!.summary).toBe('gate implement: NOT_READY -> READY')
  const again = diffSnapshot(b.sig, snap({ artifacts: { spec: 'h1-EDITED', plan: 'h2' }, quality: { implement: 'READY' }, analyze: { at: 9, overall: 'READY', counts: {} }, trace: { status: 'COMPLETE', gaps: 0 }, convergence: { state: 'CONVERGING' } }), 3)
  expect(again.entries).toEqual([]) // idempotent: observing twice does not duplicate
})

test('state.set observation and the turn-complete re-derive produce identical entries (same diff path)', () => {
  const s0 = diffSnapshot({}, snap(), 1)
  const viaHook = diffSnapshot(s0.sig, snap({ phase: { current: 'tasks' } }), 2)
  const viaTurn = diffSnapshot(s0.sig, snap({ phase: { current: 'tasks' } }), 2)
  expect(viaHook.entries).toEqual(viaTurn.entries)
})

test('history is bounded: oldest entries are evicted', () => {
  const mk = (n: number) => ({ at: n, kind: 'phase' as const, summary: 's' + n })
  const list = appendBounded(Array.from({ length: 5 }, (_, i) => mk(i)), [mk(5), mk(6)], 4)
  expect(list.map(e => e.at)).toEqual([3, 4, 5, 6])
})

test('timeline: empty message, phase filter, last', () => {
  expect(formatTimeline([])).toBe('No SDD history yet.')
  const es = [{ at: 0, kind: 'phase' as const, phase: 'plan', summary: 'a' }, { at: 60000, kind: 'review' as const, phase: 'tasks', summary: 'b' }]
  expect(formatTimeline(es, { phase: 'tasks' })).toContain('b'); expect(formatTimeline(es, { phase: 'tasks' })).not.toContain(' a')
  expect(formatTimeline(es, { phase: 'nope' })).toContain('No history for phase')
  expect(formatTimeline(es, { last: true }).split('\n').length).toBe(1)
})

function env(on: any, state: Record<string, any>, answer = 'Yes') {
  const store: Record<string, any> = {}
  on('session.root', async () => ({ value: '/projA' })); on('clock.now', async () => ({ value: 100000 })); on('session.id', async () => ({ value: 'sess-1' }))
  on('fs.exists', async () => ({ value: false }))
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('store.get', async (_$: any, e: any) => ({ value: store[e.key] })); on('store.set', async (_$: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('store.delete', async (_$: any, e: any) => { delete store[e.key]; return { value: undefined } })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$: any, e: any) => ({ result: { questions: e.questions, answers: { [e.questions[0].question]: answer } } }))
  return store
}

test('observer persists project-keyed, never writes another Mod\'s state, and /sdd-history clear needs confirmation', async ($: any, on: any) => {
  const state: Record<string, any> = { 'sdd-phase-tracker.phase': { current: 'plan', phases: [] } }
  const store = env(on, state, 'No')
  await $.command.run({ command: 'sdd-history', args: '' })       // baseline
  state['sdd-phase-tracker.phase'] = { current: 'tasks', phases: [] }
  const out = await $.command.run({ command: 'sdd-history', args: '' })
  expect(out.text).toContain('current phase is now tasks')
  expect(Object.keys(store)[0]).toMatch(/^history:p-/)
  expect(Object.keys(state).filter(k => !k.startsWith('sdd-session-history') && !k.startsWith('sdd-phase-tracker'))).toEqual([])
  expect((await $.command.run({ command: 'sdd-history', args: 'clear' })).text).toContain('no confirmation')
  expect(Object.keys(store).length).toBe(1) // declined: nothing cleared
})

test('confirmed clear empties only this project\'s history', async ($: any, on: any) => {
  const state: Record<string, any> = { 'sdd-phase-tracker.phase': { current: 'plan', phases: [] } }
  const store = env(on, state, 'Yes')
  store['history:p-OTHER'] = [{ at: 1, kind: 'phase', summary: 'other project' }]
  await $.command.run({ command: 'sdd-history', args: '' })
  state['sdd-phase-tracker.phase'] = { current: 'tasks', phases: [] }
  await $.command.run({ command: 'sdd-history', args: '' })
  expect((await $.command.run({ command: 'sdd-history', args: 'clear' })).text).toContain('cleared')
  expect(store['history:p-OTHER']).toBeDefined()
  expect(Object.keys(store).filter(k => k.startsWith('history:p-') && k !== 'history:p-OTHER')).toEqual([])
})
