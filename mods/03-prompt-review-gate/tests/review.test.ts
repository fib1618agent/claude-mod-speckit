import { test, expect, mock } from 'claude-code/testing'
import { ensureHeader, gateBlock, isHuman, parseEditCopy, phaseOfCommand, phaseOfText, preview } from '../hooks/lib/review'

const PHASES = ['constitution', 'specify', 'clarify', 'plan', 'checklist', 'tasks', 'analyze', 'implement', 'converge']

test('detection is limited to the discovered phase set (no hard-coded guessing)', () => {
  expect(phaseOfCommand('speckit-plan', PHASES)).toBe('plan')
  expect(phaseOfCommand('speckit.analyze', PHASES)).toBe('analyze')
  expect(phaseOfCommand('speckit-converge', PHASES)).toBe('converge')
  expect(phaseOfCommand('speckit-taskstoissues', PHASES)).toBeUndefined() // not in this phase set
  expect(phaseOfCommand('speckit-taskstoissues', [...PHASES, 'taskstoissues'])).toBe('taskstoissues')
  expect(phaseOfCommand('plan', PHASES)).toBeUndefined()
  expect(phaseOfCommand('sdd-run', PHASES)).toBeUndefined()
  expect(phaseOfText('/speckit-plan build a todo app', PHASES)).toEqual({ phase: 'plan', args: 'build a todo app' })
  expect(phaseOfText('please run /speckit-plan', PHASES)).toBeUndefined()
})

test('header survives edits; gate blocks on BLOCKED/NOT_READY only; humans are composer/bridge', () => {
  expect(ensureHeader('body', 'plan').startsWith('# Reviewed SDD execution — phase: plan')).toBe(true)
  const once = ensureHeader('body', 'plan'); expect(ensureHeader(once, 'plan')).toBe(once)
  expect(gateBlock(undefined)).toBeUndefined()
  expect(gateBlock({ display: 'READY', status: 'PASS', blockers: [], warnings: [] })).toBeUndefined()
  expect(gateBlock({ display: 'WARNING', status: 'PASS_WITH_WARNINGS', blockers: [], warnings: ['x'] })).toBeUndefined()
  expect(gateBlock({ display: 'BLOCKED', status: 'BLOCKED', blockers: ['b'], warnings: [] })).toContain('BLOCKED')
  expect(gateBlock({ display: 'NOT_READY', status: 'NOT_READY', blockers: ['Analyze has not been run'], warnings: [] })).toContain('Analyze')
  expect(isHuman({ kind: 'composer' })).toBe(true); expect(isHuman({ kind: 'sdk' })).toBe(false); expect(isHuman({ kind: 'plugin' })).toBe(false)
  expect(parseEditCopy('<!-- sdd-review-edit:r1-1 -->\nbody')).toEqual({ id: 'r1-1', body: 'body' })
})

// ---- integration world -----------------------------------------------------------------------------------------------
// A fake 02 (self-contained) answers `sdd-prompt resolve <id> <phase> ...` by publishing promptResolution.
const FAKE_PROMPT_MANAGER = {
  name: 'sdd-prompt-manager',
  register(on: any) {
    on('command.run', { command: 'sdd-prompt' }, async ($: any, e: any) => {
      const [, id = '', phase = ''] = String(e.args).split(/\s+/)
      const blocked = phase === 'tasks'
      await $.state.set({ plugin: 'sdd-prompt-manager', key: 'promptResolution' }, blocked
        ? { phase, templateId: '', version: '', hash: '', layers: [], access: 'unknown', status: 'blocked', reason: 'no template', requestId: id }
        : { phase, templateId: 'pack:' + phase, version: '1', hash: 'h', layers: [], access: phase === 'analyze' ? 'read-only' : 'modifies-files', status: 'resolved', composed: `# Reviewed SDD execution — phase: ${phase}\n\nCOMPOSED ${phase}`, requestId: id })
      return { text: 'resolved' }
    })
  },
}

type World = { state: Record<string, any>; submitted: any[]; bottomCommands: string[]; clock: any; filled: string[] }
function world(on: any, o: { gate?: any; answer?: string | 'deny'; navigator?: boolean; config?: string } = {}): World {
  const w: World = { state: {}, submitted: [], bottomCommands: [], clock: undefined, filled: [] }
  w.clock = mock.clock(on)
  if (o.gate) w.state['sdd-quality-gate.quality'] = { gates: { [o.gate.phase]: o.gate }, blockers: [], warnings: [], approval: {}, at: 1 }
  on('session.root', async () => ({ value: '/proj' }))
  on('ui.toast', async () => ({ value: undefined }))
  on('fs.exists', async (_$: any, e: any) => ({ value: !!o.config && e.path.endsWith('config.yaml') }))
  on('fs.read', async () => ({ value: o.config ?? '' }))
  on('fs.list', async () => { throw new Error('ENOENT') })
  on('state.get', async (_$: any, e: any) => ({ value: { value: w.state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { w.state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  on('command.list', async () => ({ value: o.navigator ? [{ name: 'sdd' }] : [] }))
  on('command.run', async (_$: any, e: any) => { w.bottomCommands.push(e.command); return { text: 'bottom:' + e.command } })
  on('prompt.submit', async (_$: any, e: any) => { w.submitted.push(e); return { text: e.text } })
  on('turn.complete', async () => ({ text: '' }))
  on('prompt.fill', async (_$: any, e: any) => { w.filled.push(e.text); return { isFilled: true, text: e.text, cursor: 0 } })
  on('tool.call', async (_$: any, e: any) => {
    if (e.tool === 'AskUserQuestion') return o.answer === 'deny' ? { deny: 'nobody to ask' } : { result: { questions: e.questions, answers: { [e.questions[0].question]: o.answer ?? 'Cancel' } } }
    return { result: { ok: true }, text: 'ran' }
  })
  return w
}
const PLUGINS = { plugins: [FAKE_PROMPT_MANAGER] }
const settle = async (w: World) => { await w.clock.advance(5); await w.clock.settle() }
const human = { kind: 'composer' }
const gate = (status: string, display: string, blockers: string[] = []) => ({ phase: 'plan', status, display, blockers, warnings: [], evidence: [], at: 1 })

test('PATH command: typed /speckit-plan is intercepted, never reaches the model, and nothing runs without approval', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { answer: 'Cancel' })
  const out = await $.command.run({ command: 'speckit-plan', args: 'build a todo app' })
  expect(out.text).toContain('review required'); expect(w.bottomCommands).not.toContain('speckit-plan')
  expect(w.state['sdd-prompt-review.review'].state).toBe('pending')
  await settle(w)
  expect(w.submitted).toEqual([]) // composing never submits
  expect(w.state['sdd-prompt-review.review'].state).toBe('cancelled') // dialog answered Cancel
})

test('approve through the dialog: exactly one plugin submission carrying the reviewed header; state approved with a hash', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { answer: 'Run' })
  await $.command.run({ command: 'speckit-plan', args: 'x' })
  await settle(w)
  expect(w.submitted.length).toBe(1)
  expect(w.submitted[0].text.startsWith('# Reviewed SDD execution — phase: plan')).toBe(true)
  expect(w.submitted[0].origin.kind).toBe('plugin'); expect(w.submitted[0].origin.name).toBe('sdd-prompt-review')
  const r = w.state['sdd-prompt-review.review']
  expect(r.state).toBe('approved'); expect(r.promptHash).toMatch(/^[0-9a-f]{16}$/); expect(r.path).toBe('command')
})

test('PATH prompt: raw typed text that reached prompt.submit is dropped with a reason and funneled into the same review', PLUGINS, async ($: any, on: any) => {
  const w = world(on)
  const res = await $.prompt.submit({ text: '/speckit-plan x', origin: human, wait: false })
  expect(res.drop).toContain('review required')
  expect(w.state['sdd-prompt-review.review'].path).toBe('prompt')
})

test('PATH tool: a model-invoked Skill for a Spec-Kit phase is denied into the same review; other skills pass', PLUGINS, async ($: any, on: any) => {
  const w = world(on)
  const denied = await $.tool.call({ tool: 'Skill', skill: 'speckit-analyze', tool_use_id: 'u1' })
  expect(denied.deny).toContain('review required')
  expect(w.state['sdd-prompt-review.review'].path).toBe('tool'); expect(w.state['sdd-prompt-review.review'].phase).toBe('analyze')
  const other = await $.tool.call({ tool: 'Skill', skill: 'frontend-design', tool_use_id: 'u2' })
  expect(other.deny).toBeUndefined()
})

test('all paths converge: a second request while one is pending is coalesced, never a second review', PLUGINS, async ($: any, on: any) => {
  const w = world(on)
  await $.command.run({ command: 'speckit-plan', args: '' })
  const dup = await $.command.run({ command: 'speckit-plan', args: '' })
  expect(dup.text).toContain('already pending')
  const other = await $.command.run({ command: 'speckit-tasks', args: '' })
  expect(other.text).toContain('Another review')
  expect(w.state['sdd-prompt-review.review'].phase).toBe('plan')
})

test('/sdd-run is the explicit entry and rejects phases outside the discovered set', PLUGINS, async ($: any, on: any) => {
  const w = world(on)
  expect((await $.command.run({ command: 'sdd-run', args: 'bogus' })).text).toContain('not in the discovered')
  expect((await $.command.run({ command: 'sdd-run', args: 'plan make it' })).text).toContain('review required')
  expect(w.state['sdd-prompt-review.review'].path).toBe('sdd-run')
})

test('review mode disabled restores normal behavior: the command reaches the engine', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { config: 'review:\n  enabled: false\n' })
  const out = await $.command.run({ command: 'speckit-plan', args: 'x' })
  expect(out.text).toBe('bottom:speckit-plan'); expect(w.state['sdd-prompt-review.review']).toBeUndefined()
})

test('unrelated commands and tools are never intercepted', PLUGINS, async ($: any, on: any) => {
  const w = world(on)
  expect((await $.command.run({ command: 'help', args: '' })).text).toBe('bottom:help')
  expect((await $.tool.call({ tool: 'Bash', command: 'ls', tool_use_id: 'u' })).deny).toBeUndefined()
  expect(w.state['sdd-prompt-review.review']).toBeUndefined()
})

test('blocked prompt resolution cancels the review with the reason; nothing runs', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { answer: 'Run' })
  await $.command.run({ command: 'speckit-tasks', args: '' })
  await settle(w)
  expect(w.submitted).toEqual([])
  expect(w.state['sdd-prompt-review.review'].state).toBe('cancelled'); expect(w.state['sdd-prompt-review.review'].reason).toContain('no template')
})

test('fail closed: no way to ask (like -p) cancels; nothing runs', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { answer: 'deny' })
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  expect(w.submitted).toEqual([]); expect(w.state['sdd-prompt-review.review'].state).toBe('cancelled'); expect(w.state['sdd-prompt-review.review'].reason).toContain('fail closed')
})

test('quality gate NOT_READY / BLOCKED blocks Run even through /sdd-review run', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { answer: 'Cancel', navigator: true, gate: gate('NOT_READY', 'NOT_READY', ['Analyze has not been run']) })
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'review' }
  on('command.run', { command: 'sdd' }, async () => ({ text: 'nav' }))
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  const out = await $.command.run({ command: 'sdd-review', args: 'run', origin: human })
  expect(out.text).toContain('Run blocked'); expect(out.text).toContain('Analyze has not been run')
  expect(w.submitted).toEqual([])
})

test('approval needs a human: sdk / plugin origins cannot run, cancel or edit', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { navigator: true })
  on('command.run', { command: 'sdd' }, async () => ({ text: 'nav' }))
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  for (const origin of [{ kind: 'sdk' }, { kind: 'plugin', name: 'sdd-analyze-gate' }]) {
    expect((await $.command.run({ command: 'sdd-review', args: 'run', origin })).text).toContain('must be typed by a person')
  }
  expect(w.submitted).toEqual([])
  expect(w.state['sdd-prompt-review.review'].state).toBe('pending')
})

test('Edit then Run: the edit is captured (not sent), changes the hash, and only Run executes the edited copy', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { navigator: true })
  on('command.run', { command: 'sdd' }, async () => ({ text: 'nav' }))
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  const before = w.state['sdd-prompt-review.review'].promptHash
  await $.command.run({ command: 'sdd-review', args: 'edit', origin: human })
  const id = /sdd-review-edit:([\w-]+)/.exec(w.filled[0]!)![1]
  const cap = await $.prompt.submit({ text: `<!-- sdd-review-edit:${id} -->\nMY EDITED PROMPT`, origin: human, wait: false })
  expect(cap.drop).toContain('captured'); expect(w.submitted).toEqual([])
  const r = w.state['sdd-prompt-review.review']
  expect(r.promptHash).not.toBe(before); expect(r.edited).toBe(true); expect(r.state).toBe('pending')
  await $.command.run({ command: 'sdd-review', args: 'run', origin: human })
  await settle(w)
  expect(w.submitted.length).toBe(1)
  expect(w.submitted[0].text).toContain('MY EDITED PROMPT'); expect(w.submitted[0].text.startsWith('# Reviewed SDD execution — phase: plan')).toBe(true)
})

test('Edit then Cancel runs nothing; Cancel runs nothing', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { navigator: true })
  on('command.run', { command: 'sdd' }, async () => ({ text: 'nav' }))
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  await $.command.run({ command: 'sdd-review', args: 'edit', origin: human })
  const out = await $.command.run({ command: 'sdd-review', args: 'cancel', origin: human })
  expect(out.text).toContain('Cancelled'); expect(w.submitted).toEqual([]); expect(w.state['sdd-prompt-review.review'].state).toBe('cancelled')
  expect((await $.command.run({ command: 'sdd-review', args: '' })).text).toContain('No prompt pending')
})

test('an edit captured for another request id is not accepted', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { navigator: true })
  on('command.run', { command: 'sdd' }, async () => ({ text: 'nav' }))
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  const r = await $.prompt.submit({ text: '<!-- sdd-review-edit:r999-9 -->\nEVIL', origin: human, wait: false })
  expect(r.drop).toBeUndefined()
  expect(w.state['sdd-prompt-review.review'].edited).toBeFalsy()
})

test('while an approved run executes, the same phase is not re-intercepted (no loops); it is again after the turn completes', PLUGINS, async ($: any, on: any) => {
  const w = world(on, { answer: 'Run' })
  await $.command.run({ command: 'speckit-plan', args: '' })
  await settle(w)
  expect((await $.tool.call({ tool: 'Skill', skill: 'speckit-plan', tool_use_id: 'u1' })).deny).toBeUndefined()
  await $.turn.complete({ reason: 'answer', turnId: 't', answer: '', durationMs: 1, isAborted: false })
  expect((await $.tool.call({ tool: 'Skill', skill: 'speckit-plan', tool_use_id: 'u2' })).deny).toContain('review required')
})

test('preview collapses blank lines, caps length, and points to Edit for the rest', () => {
  expect(preview('a\n\n\n\nb   \n\nc')).toBe('a\nb\nc')
  const p = preview('x'.repeat(1000))
  expect(p.startsWith('x'.repeat(400))).toBe(true)
  expect(p).toContain('600 more characters; use Edit to see all')
  expect(preview('short')).toBe('short')
})
