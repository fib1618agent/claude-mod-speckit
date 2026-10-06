import { test, expect, mock } from 'claude-code/testing'
import { NAV, RESERVED_HOTKEYS, containsView, isUnavailable, parseView, statusLine, unavailableText } from '../hooks/lib/nav'

test('mapping is final: 1-9, 0 and lowercase p; ⑪ is served by the Prompt Manager; keys are unique', () => {
  expect(NAV.map(n => n.key).join('')).toBe('1234567890p')
  expect(NAV.find(n => n.key === 'p')!.id).toBe('prompts'); expect(NAV.find(n => n.key === 'p')!.capability).toBe('prompt')
  expect(NAV.find(n => n.key === '0')!.id).toBe('control')
  expect(new Set(RESERVED_HOTKEYS).size).toBe(RESERVED_HOTKEYS.length); expect(RESERVED_HOTKEYS).toContain('b')
  expect(RESERVED_HOTKEYS.includes('P')).toBe(false)
})

test('parseView accepts ids, keys and a few aliases; rejects nonsense', () => {
  expect(parseView('analyze')).toBe('analyze'); expect(parseView('4')).toBe('analyze'); expect(parseView('p')).toBe('prompts'); expect(parseView('0')).toBe('control')
  expect(parseView('status')).toBe('phase'); expect(parseView('catalog')).toBe('prompts'); expect(parseView('P')).toBe('prompts') // case-insensitive input is fine; the hotkey itself is lowercase
  expect(parseView('nonsense')).toBeUndefined()
})

test('status line uses statuses, never an invented score', () => {
  expect(statusLine({ phase: 'plan', quality: 'READY', progress: '4/9', convergence: 'IN_PROGRESS' })).toBe('SDD | PLAN | Gate READY | 4/9 | Conv IN_PROGRESS')
  expect(statusLine({ phase: 'plan', quality: 'unavailable', convergence: 'unavailable' })).toBe('SDD | PLAN')
  expect(statusLine({})).toBe('SDD | unavailable')
  expect(statusLine({ phase: 'unknown', convergence: 'NOT_STARTED' })).toContain('PHASE ?')
  expect(statusLine({ phase: 'plan', quality: 'READY', progress: '4/9', convergence: 'X' })).not.toMatch(/\d+\s*%/)
})

test('availability: missing or unavailable capability is unavailable; degraded is still usable', () => {
  expect(isUnavailable(undefined)).toBe(true); expect(isUnavailable({ status: 'unavailable' })).toBe(true)
  expect(isUnavailable({ status: 'degraded', reason: 'x' })).toBe(false); expect(isUnavailable({ status: 'ready' })).toBe(false)
  const t = unavailableText(NAV[3]!, undefined)
  expect(t).toContain('Capability unavailable'); expect(t.join('\n')).toContain('Reason:')
  expect(containsView({ children: ['SDD / ANALYZE'] })).toBe(true); expect(containsView({ children: ['nothing'] })).toBe(false)
})

// ---- integration (harness) ---------------------------------------------------------------------------------------------
const ALL_CAPS = ['sdd-phase-tracker', 'sdd-prompt-manager', 'sdd-prompt-review', 'sdd-analyze-gate', 'sdd-artifact-tracker', 'sdd-quality-gate', 'sdd-traceability', 'sdd-convergence-tracker', 'sdd-session-history', 'sdd-control-plane']
type W = { state: Record<string, any>; opened: any[]; closed: any[]; status: string[]; toasts: string[]; clock: any }
function world(on: any, o: { caps?: string[]; placed?: boolean } = {}): W {
  const w: W = { state: {}, opened: [], closed: [], status: [], toasts: [], clock: mock.clock(on) }
  for (const p of o.caps ?? ALL_CAPS) w.state[p + '.capability'] = { id: p, version: '1', status: 'ready' }
  on('session.root', async () => ({ value: '/p' })); on('fs.exists', async () => ({ value: false }))
  on('state.get', async (_$: any, e: any) => ({ value: { value: w.state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { w.state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  on('ui.open', async (_$: any, e: any) => { w.opened.push(e); return { value: { isPlaced: o.placed ?? true } } })
  on('ui.close', async (_$: any, e: any) => { w.closed.push(e); return { value: undefined } })
  on('ui.status', async (_$: any, e: any) => { w.status.push(e.text); return { value: undefined } })
  on('ui.toast', async (_$: any, e: any) => { w.toasts.push(e.text); return { value: undefined } })
  return w
}
const props = { title: 'SDD', isFocused: true, bodyColumns: 100, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} } as any
const mountNav = ($: any, p: any = props) => $.ui.mount({ plugin: 'sdd-navigator', surface: 'terminal', component: 'Pane', props: p, requestId: 'sdd', viewport: { columns: 120, rows: 40 } })
const capView = (name: string) => ({
  name: 'cap-' + name, tier: 'append' as const,
  register(on: any) {
    on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($: any, e: any) => {
      const { Box, Text, Button } = $.ui.resolve(e)
      return h(Box, { flexDirection: 'column' }, h(Text, {}, 'SDD / ' + $.plugin.name.replace('cap-', '').toUpperCase()), h(Button, { key: 'cap-act', label: 'Act', hotkey: 'a', onPress: () => { $.ui.toast('cap-pressed') } }))
    })
  },
})
const buttons = async (ui: any) => (await ui.findAll({ type: 'Button' })) as any[]

test('shell: all 11 entries as Buttons with their hotkeys, plus Close; no Back until a view is active', async ($: any, on: any) => {
  world(on)
  const ui = await mountNav($)
  const tree = JSON.stringify(await ui.drawn())
  for (const n of NAV) { expect(tree).toContain(n.label); expect(tree).toContain(`"hotkey":"${n.key}"`) }
  expect(tree).toContain('× Close'); expect(tree).not.toContain('"hotkey":"b"')
})

test('active view: capability tree is embedded UNDER the shell, nav row stays, Back appears, capability hotkey and press survive', { plugins: [capView('analyze')] }, async ($: any, on: any) => {
  const w = world(on)
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'analyze', mode: 'embed' }
  const ui = await mountNav($)
  const tree = JSON.stringify(await ui.drawn())
  expect(tree.indexOf('① Phase')).toBeLessThan(tree.indexOf('SDD / ANALYZE')) // shell first, view beneath
  expect(tree).toContain('"hotkey":"b"'); expect(tree).toContain('"hotkey":"a"')
  await ui.press({ plugin: 'cap-analyze', key: 'cap-act' })
  expect(w.toasts).toContain('cap-pressed')
})

test('unavailable capability: entry marked, unavailable view with a reason, nothing crashes', async ($: any, on: any) => {
  const w = world(on, { caps: ALL_CAPS.filter(p => p !== 'sdd-analyze-gate') })
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'analyze', mode: 'embed' }
  const ui = await mountNav($)
  const tree = JSON.stringify(await ui.drawn())
  expect(tree).toContain('[④ Analyze unavailable]'); expect(tree).toContain('Capability unavailable'); expect(tree).toContain('Reason:')
  expect(tree).toContain('① Phase')
})

test('degraded capability stays usable and is not marked unavailable', { plugins: [capView('phase')] }, async ($: any, on: any) => {
  const w = world(on)
  w.state['sdd-phase-tracker.capability'] = { id: 'phase', version: '1', status: 'degraded', reason: 'no inventory' }
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'phase', mode: 'embed' }
  const tree = JSON.stringify(await (await mountNav($)).drawn())
  expect(tree).not.toContain('unavailable]'); expect(tree).toContain('SDD / PHASE')
})

test('automatic fallback: a ready capability whose view never reaches the shell switches the session to one-pane-at-a-time', async ($: any, on: any) => {
  const w = world(on)
  on('ui.render', async () => { throw new Error('nothing beneath draws') })
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'trace', mode: 'embed' }
  const ui = await mountNav($)
  expect(JSON.stringify(await ui.drawn())).toContain('did not render in the shell')
  await w.clock.advance(5); await w.clock.settle()
  expect(w.state['sdd-navigator.view'].mode).toBe('panes')
  expect(w.opened.some(o => o.id === 'sdd-view')).toBe(true)
})

test('/sdd opens the shell pane with Esc-closes and focus; /sdd <view> selects it; unknown view explains', async ($: any, on: any) => {
  const w = world(on)
  expect((await $.command.run({ command: 'sdd', args: '' })).text).toContain('opened')
  expect(w.opened[0]).toMatchObject({ id: 'sdd', closeOnEscape: true, focus: true })
  expect(w.state['sdd-navigator.view']).toMatchObject({ isOpen: true, activeView: null })
  await $.command.run({ command: 'sdd', args: 'analyze' })
  expect(w.state['sdd-navigator.view'].activeView).toBe('analyze')
  await $.command.run({ command: 'sdd', args: 'p' })
  expect(w.state['sdd-navigator.view'].activeView).toBe('prompts')
  expect((await $.command.run({ command: 'sdd', args: 'bogus' })).text).toContain('Unknown view')
})

test('when no pane can be shown, /sdd answers with the supported text commands (no invented fallback)', async ($: any, on: any) => {
  world(on, { placed: false })
  const out = await $.command.run({ command: 'sdd', args: '' })
  expect(out.text).toContain('could not be shown'); expect(out.text).toContain('/sdd-status')
})

const CLOSER = { name: 'closer', tier: 'user' as const, register(on: any) { on('command.run', { command: 'closeit' }, async ($: any) => { await $.ui.close({ id: 'sdd' }); return { text: 'closed' } }) } }
test('Esc/close ends the Navigator: state isOpen=false, activeView cleared (Back is a different action)', { plugins: [CLOSER] }, async ($: any, on: any) => {
  const w = world(on)
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'quality', mode: 'embed' }
  await $.command.run({ command: 'closeit' })
  expect(w.state['sdd-navigator.view']).toMatchObject({ isOpen: false, activeView: null })
})

test('Back clears only the active view and keeps the Navigator open', async ($: any, on: any) => {
  const w = world(on)
  w.state['sdd-navigator.view'] = { isOpen: true, activeView: 'quality', mode: 'embed' }
  on('ui.render', async () => { throw new Error('none') })
  const ui = await mountNav($)
  await ui.press({ plugin: 'sdd-navigator', key: 'nav-back' })
  expect(w.state['sdd-navigator.view']).toMatchObject({ isOpen: true, activeView: null })
})

const CONTROL_OWNER = { name: 'sdd-control-plane', tier: 'user' as const, register(on: any) {
  on('command.run', { command: 'setctl' }, async ($: any) => { await $.state.set({ plugin: 'sdd-control-plane', key: 'control' }, { summary: { phase: 'plan', quality: 'READY', progress: '4/9', convergence: 'IN_PROGRESS' }, nextAction: { text: 'x', owner: 'y', viewId: 'phase' }, at: 1 }); return { text: 'ok' } })
} }
test('status line: refreshed from the Control Plane aggregate; statuses only', { plugins: [CONTROL_OWNER] }, async ($: any, on: any) => {
  const w = world(on)
  await $.command.run({ command: 'setctl' })
  expect(w.status).toContain('SDD | PLAN | Gate READY | 4/9 | Conv IN_PROGRESS')
  expect(w.status.every(s => !/\d+\s*%/.test(s ?? ''))).toBe(true)
})

test('narrow terminals get a vertical list of the same buttons instead of an overflowing row', async ($: any, on: any) => {
  world(on)
  const ui = await mountNav($, { ...props, bodyColumns: 40 })
  const tree = JSON.stringify(await ui.drawn())
  for (const n of NAV) expect(tree).toContain(n.label)
})

test('the Navigator writes only its own state (no capability state, no business logic)', async ($: any, on: any) => {
  const w = world(on)
  await $.command.run({ command: 'sdd', args: 'phase' })
  const foreign = Object.keys(w.state).filter(k => !k.startsWith('sdd-navigator.') && !k.endsWith('.capability'))
  expect(foreign).toEqual([])
})

const rowCount = async ($: any, on: any, cols: number) => {
  world(on)
  const ui = await mountNav($, { ...props, bodyColumns: cols })
  return (JSON.stringify(await ui.drawn()).match(/"flexDirection":"row"/g) ?? []).length
}
test('wide terminal: all eleven buttons share one row', async ($: any, on: any) => {
  const wide = await rowCount($, on, 200)
  expect(wide).toBe(3) // SDD+nav wrapper, one nav row, Back/Close row
})
test('mid-width terminal keeps the two-row nav', async ($: any, on: any) => {
  expect(await rowCount($, on, 100)).toBe(4) // 2 nav rows + wrapper + Back/Close row
})
