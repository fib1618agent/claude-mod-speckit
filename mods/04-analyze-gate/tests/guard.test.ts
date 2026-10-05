import { test, expect } from 'claude-code/testing'

function env(on: any, report: string) {
  const state: Record<string, any> = {}
  const store: Record<string, any> = {}
  on('session.root', async () => ({ value: '/proj' })); on('clock.now', async () => ({ value: 9 }))
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('store.get', async (_$: any, e: any) => ({ value: store[e.key] }))
  on('store.set', async (_$: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))
  on('tool.call', async () => ({ result: { ok: true }, text: 'ran' }))
  on('turn.complete', async () => ({ text: report }))
  void report
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  return { state, store }
}
const ANALYZE_PROMPT = '# Reviewed SDD execution — phase: analyze\nbody'
const submit = ($: any, text: string, origin: any) => $.prompt.submit({ text, origin, wait: false })
const good = '```sdd-findings\n[{"id":"A1","severity":"HIGH","category":"c","artifact":"spec","evidence":"e","explanation":"x","recommendation":"r"}]\n```\noverall: NOT_READY'
let answerText = ''
const tc = ($: any) => $.turn.complete({ reason: 'answer', turnId: 't1', answer: answerText, durationMs: 1, isAborted: false })

test('guard is OFF until an approved reviewed analyze submission arrives', async ($: any, on: any) => {
  env(on, good)
  const r = await $.tool.call({ tool: 'Write', file_path: '/proj/a.txt', content: 'x', tool_use_id: 'u1' })
  expect(r.deny).toBeUndefined()
})

test('guard arms only for plugin-origin from the Review Gate for phase analyze, then denies mutations', async ($: any, on: any) => {
  env(on, good)
  await submit($, ANALYZE_PROMPT, { kind: 'plugin', name: 'sdd-prompt-review' })
  const w = await $.tool.call({ tool: 'Write', file_path: '/proj/a.txt', content: 'x', tool_use_id: 'u1' })
  expect(w.deny).toContain('read-only')
  const b = await $.tool.call({ tool: 'Bash', command: 'rm -rf specs', tool_use_id: 'u2' })
  expect(b.deny).toContain('read-only')
  const ok = await $.tool.call({ tool: 'Bash', command: 'git status', tool_use_id: 'u3' })
  expect(ok.deny).toBeUndefined()
})

test('guard does NOT arm for the wrong origin, the wrong plugin name, or another phase', async ($: any, on: any) => {
  env(on, good)
  await submit($, ANALYZE_PROMPT, { kind: 'composer' })
  await submit($, ANALYZE_PROMPT, { kind: 'plugin', name: 'some-other-plugin' })
  await submit($, '# Reviewed SDD execution — phase: plan\nbody', { kind: 'plugin', name: 'sdd-prompt-review' })
  const w = await $.tool.call({ tool: 'Write', file_path: '/proj/a.txt', content: 'x', tool_use_id: 'u1' })
  expect(w.deny).toBeUndefined()
})

test('turn completion records the result, disarms the guard and persists project-keyed', async ($: any, on: any) => {
  const e = env(on, good)
  answerText = good
  await submit($, ANALYZE_PROMPT, { kind: 'plugin', name: 'sdd-prompt-review' })
  await tc($)
  const r = e.state['sdd-analyze-gate.analyze']
  expect(r.countsBySeverity.HIGH).toBe(1); expect(r.overall).toBe('NOT_READY')
  expect(Object.keys(e.store)[0]).toMatch(/^analyze:p-/)
  const w = await $.tool.call({ tool: 'Write', file_path: '/proj/a.txt', content: 'x', tool_use_id: 'u2' })
  expect(w.deny).toBeUndefined() // disarmed
})

test('an unparsable report is recorded UNKNOWN, never READY', async ($: any, on: any) => {
  const e = env(on, 'I analyzed it, looks fine.')
  answerText = 'I analyzed it, looks fine.'
  await submit($, ANALYZE_PROMPT, { kind: 'plugin', name: 'sdd-prompt-review' })
  await tc($)
  expect(e.state['sdd-analyze-gate.analyze'].overall).toBe('UNKNOWN')
})

test('/sdd-analyze run only delegates: it answers at once and never runs analysis itself', async ($: any, on: any) => {
  const e = env(on, good)
  const out = await $.command.run({ command: 'sdd-analyze', args: 'run' })
  expect(out.text).toContain('Review Gate'); expect(e.state['sdd-analyze-gate.analyze']).toBeUndefined()
})
