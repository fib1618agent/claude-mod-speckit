import { test, expect } from 'claude-code/testing'

type Files = Record<string, string>
function env(on: any, files: Files, answer: 'Yes' | 'No' | 'throw' = 'Yes') {
  const state: Record<string, any> = {}
  const writes: Record<string, string> = {}
  on('session.root', async () => ({ value: '/proj' }))
  on('fs.exists', async (_$: any, e: any) => ({ value: e.path in files || e.path in writes }))
  on('fs.read', async (_$: any, e: any) => ({ value: writes[e.path] ?? files[e.path] ?? '' }))
  on('fs.list', async (_$: any, e: any) => {
    const names = e.path === '/proj/.claude/skills' ? ['speckit-plan', 'speckit-analyze', 'speckit-tasks'] : null
    if (!names) throw new Error('ENOENT')
    return { value: names.map(name => ({ name, kind: 'dir', size: 0, mtimeMs: 1, isLink: false })) }
  })
  on('fs.stat', async (_$: any, e: any) => ({ value: { kind: 'dir', size: 0, mtimeMs: 1, isLink: false, realPath: e.path } }))
  on('fs.write', async (_$: any, e: any) => { writes[e.path] = e.text; return { value: undefined } })
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  on('prompt.fill', async (_$: any, e: any) => { state.filled = e.text; return { isFilled: true, text: e.text, cursor: 0 } })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$: any, e: any) => {
    if (answer === 'throw') return { deny: 'no one to ask' }
    return { result: { questions: e.questions, answers: { [e.questions[0].question]: answer } } }
  })
  return { state, writes }
}

const PACK = '/packs/11-default-sdd-prompt-pack'
const baseFiles = (): Files => ({
  [`${PACK}/pack.json`]: JSON.stringify({ templates: [{ phase: 'plan', file: 'prompts/plan.md', version: '1', access: 'modifies-files' }, { phase: 'analyze', file: 'prompts/analyze.md', version: '1', access: 'read-only' }] }),
  [`${PACK}/prompts/plan.md`]: '<!-- sdd-pack: phase=plan version=1 access=modifies-files -->\nPACK PLAN',
  [`${PACK}/prompts/analyze.md`]: '<!-- sdd-pack: phase=analyze version=1 access=read-only -->\nPACK ANALYZE',
  '/proj/.claude/skills/speckit-plan/SKILL.md': '---\nname: speckit-plan\n---\nUPSTREAM $ARGUMENTS',
})
const cfgFiles = (f: Files): Files => ({ ...f, '/proj/.speckit/mod/config.yaml': `prompt:\n  packDir: ${PACK}\n` })

test('resolve: falls back to the Prompt Pack default and keeps upstream first (precedence visible)', async ($: any, on: any) => {
  const e = env(on, cfgFiles(baseFiles()))
  const out = await $.command.run({ command: 'sdd-prompt', args: 'resolve r1 plan build a todo app' })
  expect(out.text).toContain('resolved plan: pack:plan v1')
  const r = e.state['sdd-prompt-manager.promptResolution']
  expect(r.status).toBe('resolved'); expect(r.access).toBe('modifies-files'); expect(r.requestId).toBe('r1')
  expect(r.layers[0].source).toBe('upstream')
  expect(r.composed).toContain('UPSTREAM build a todo app')
  expect(r.composed).toContain('PACK PLAN')
  expect(Object.keys(r)).not.toContain('text')
})

test('resolve: project template wins over the Pack default', async ($: any, on: any) => {
  const e = env(on, cfgFiles({ ...baseFiles(), '/proj/.speckit/mod/prompts/plan.md': 'MY PLAN' }))
  await $.command.run({ command: 'sdd-prompt', args: 'resolve r1 plan' })
  const r = e.state['sdd-prompt-manager.promptResolution']
  expect(r.templateId).toBe('project-template:plan'); expect(r.composed).toContain('MY PLAN'); expect(r.composed).not.toContain('PACK PLAN')
})

test('resolve: missing template is BLOCKED (no pack, no project template)', async ($: any, on: any) => {
  const e = env(on, { '/proj/.claude/skills/speckit-plan/SKILL.md': 'x' })
  const out = await $.command.run({ command: 'sdd-prompt', args: 'resolve r1 plan' })
  expect(out.text).toContain('BLOCKED'); expect(e.state['sdd-prompt-manager.promptResolution'].status).toBe('blocked')
})

test('resolve: malformed template blocks; unknown phase blocks; hostile phase blocks', async ($: any, on: any) => {
  const e = env(on, cfgFiles({ ...baseFiles(), '/proj/.speckit/mod/prompts/plan.md': '<!-- sdd-pack: phase=tasks version=1 -->\nx' }))
  expect((await $.command.run({ command: 'sdd-prompt', args: 'resolve r1 plan' })).text).toContain('malformed')
  expect((await $.command.run({ command: 'sdd-prompt', args: 'resolve r2 bogus' })).text).toContain('not in the configured')
  expect((await $.command.run({ command: 'sdd-prompt', args: 'resolve r3 ../etc' })).text).toContain('invalid phase')
  expect(Object.keys(e.writes)).toEqual([])
})

test('edit fills the composer with a marker; submit captures the draft (dropped, not sent); save writes only after confirmation', async ($: any, on: any) => {
  const e = env(on, cfgFiles(baseFiles()), 'Yes')
  on('prompt.submit', async (_$: any, p: any) => ({ text: p.text }))
  await $.command.run({ command: 'sdd-prompt', args: 'edit plan' })
  expect(e.state.filled).toContain('<!-- sdd-edit:plan -->'); expect(e.state.filled).toContain('PACK PLAN')
  const sent = await $.prompt.submit({ text: '<!-- sdd-edit:plan -->\nEDITED PLAN', origin: { kind: 'composer' }, wait: false })
  expect(sent.drop).toContain('captured, not sent')
  expect(Object.keys(e.writes)).toEqual([]) // editing writes nothing
  const out = await $.command.run({ command: 'sdd-prompt', args: 'save plan' })
  expect(out.text).toContain('Saved project template')
  expect(e.writes['/proj/.speckit/mod/prompts/plan.md']).toBe('EDITED PLAN')
})

test('edit then cancel: a declined save writes nothing and a normal prompt is never captured', async ($: any, on: any) => {
  const e = env(on, cfgFiles(baseFiles()), 'No')
  on('prompt.submit', async (_$: any, p: any) => ({ text: p.text }))
  await $.prompt.submit({ text: '<!-- sdd-edit:plan -->\nDRAFT', origin: { kind: 'composer' }, wait: false })
  expect((await $.command.run({ command: 'sdd-prompt', args: 'save plan' })).text).toContain('Not saved')
  expect(Object.keys(e.writes)).toEqual([])
  const normal = await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false })
  expect(normal.text).toBe('hello')
})

test('save without a draft writes nothing', async ($: any, on: any) => {
  const e = env(on, cfgFiles(baseFiles()))
  const out = await $.command.run({ command: 'sdd-prompt', args: 'save plan' })
  expect(out.text).toContain('No draft'); expect(Object.keys(e.writes)).toEqual([])
})

test('reset: cancellation writes nothing; confirmation restores the pack default under .speckit/mod/', async ($: any, on: any) => {
  const no = env(on, cfgFiles(baseFiles()), 'No')
  expect((await $.command.run({ command: 'sdd-prompt', args: 'reset plan' })).text).toContain('Not reset')
  expect(Object.keys(no.writes)).toEqual([])
})

test('reset with confirmation writes the default to the project template path only', async ($: any, on: any) => {
  const yes = env(on, cfgFiles(baseFiles()), 'Yes')
  const out = await $.command.run({ command: 'sdd-prompt', args: 'reset plan' })
  expect(out.text).toContain('restored')
  expect(Object.keys(yes.writes)).toEqual(['/proj/.speckit/mod/prompts/plan.md'])
})

test('no confirmation channel (ask denied, like -p) fails closed', async ($: any, on: any) => {
  const e = env(on, cfgFiles(baseFiles()), 'throw')
  expect((await $.command.run({ command: 'sdd-prompt', args: 'reset plan' })).text).toContain('Not reset')
  expect(Object.keys(e.writes)).toEqual([])
})

test('seed never overwrites an existing project template', async ($: any, on: any) => {
  const e = env(on, cfgFiles({ ...baseFiles(), '/proj/.speckit/mod/prompts/plan.md': 'MINE' }), 'Yes')
  const out = await $.command.run({ command: 'sdd-prompt', args: 'seed' })
  expect(out.text).toContain('Seeded 1')
  expect(Object.keys(e.writes)).toEqual(['/proj/.speckit/mod/prompts/analyze.md'])
})

test('overview lists phases with template source, and flags a missing Prompt Pack', async ($: any, on: any) => {
  env(on, { '/proj/.claude/skills/speckit-plan/SKILL.md': 'x' })
  const out = await $.command.run({ command: 'sdd-prompt', args: '' })
  expect(out.text).toContain('Prompt Pack NOT found'); expect(out.text).toContain('BLOCKED')
})
