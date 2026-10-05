import type { Register } from 'claude-code'
import type { SddViewId } from '../types'
import { parseConfig, section } from './shared/config'
import { NAV, containsView, isUnavailable, parseView, statusLine, unavailableText, type Cap } from './lib/nav'

const VIEW = { plugin: 'sdd-navigator', key: 'view' } as const
const CAPABILITY = { plugin: 'sdd-navigator', key: 'capability' } as const
const CONTROL = { plugin: 'sdd-control-plane', key: 'control' } as const
const PHASE = { plugin: 'sdd-phase-tracker', key: 'phase' } as const
const CONVERGENCE = { plugin: 'sdd-convergence-tracker', key: 'convergence' } as const
const CAP_PHASE = { plugin: 'sdd-phase-tracker', key: 'capability' } as const
const CAP_PROMPT = { plugin: 'sdd-prompt-manager', key: 'capability' } as const
const CAP_REVIEW = { plugin: 'sdd-prompt-review', key: 'capability' } as const
const CAP_ANALYZE = { plugin: 'sdd-analyze-gate', key: 'capability' } as const
const CAP_ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'capability' } as const
const CAP_QUALITY = { plugin: 'sdd-quality-gate', key: 'capability' } as const
const CAP_TRACE = { plugin: 'sdd-traceability', key: 'capability' } as const
const CAP_CONVERGE = { plugin: 'sdd-convergence-tracker', key: 'capability' } as const
const CAP_HISTORY = { plugin: 'sdd-session-history', key: 'capability' } as const
const CAP_CONTROL = { plugin: 'sdd-control-plane', key: 'capability' } as const

// Embedded mode is primary (Navigator is the OUTER hook; capabilities draw beneath it). If a capability's view does not appear in the
// shell (load order is not controllable and was only verified in a harness), the Navigator falls back for the session to ONE
// capability pane at a time ('sdd-view'). No plugin-precedence API is used or assumed.
let panes = false
let lastStatus: string | undefined // $.ui.status is only called when the line actually changes

async function caps($: any): Promise<Record<string, Cap>> {
  return {
    phase: (await $.state.get(CAP_PHASE)).value, prompt: (await $.state.get(CAP_PROMPT)).value, review: (await $.state.get(CAP_REVIEW)).value,
    analyze: (await $.state.get(CAP_ANALYZE)).value, artifacts: (await $.state.get(CAP_ARTIFACTS)).value, quality: (await $.state.get(CAP_QUALITY)).value,
    trace: (await $.state.get(CAP_TRACE)).value, converge: (await $.state.get(CAP_CONVERGE)).value, history: (await $.state.get(CAP_HISTORY)).value,
    control: (await $.state.get(CAP_CONTROL)).value,
  }
}

async function useDefaultMode($: any): Promise<void> {
  try {
    const root: string = await $.session.root()
    const p = `${root}/.speckit/mod/config.yaml`
    if (await $.fs.exists(p)) panes = section(parseConfig(String(await $.fs.read(p))), 'navigator').mode === 'panes'
  } catch { /* keep default (embedded) */ }
}

function showStatus($: any, text: string): void {
  if (text === lastStatus) return
  lastStatus = text
  $.ui.status(text)
}

async function refreshStatus($: any): Promise<void> {
  const control = (await $.state.get(CONTROL)).value
  const phase = (await $.state.get(PHASE)).value
  const conv = (await $.state.get(CONVERGENCE)).value
  if (control) { const s = control.summary; showStatus($, statusLine({ phase: s.phase, quality: s.quality, progress: s.progress, convergence: s.convergence })); return }
  const done = phase?.phases.filter((p: any) => p.status === 'complete').length ?? 0
  showStatus($, statusLine({ phase: phase?.current ?? undefined, progress: phase?.phases.length ? `${done}/${phase.phases.length}` : undefined, convergence: conv?.state }))
}

async function setView($: any, isOpen: boolean, activeView: SddViewId | null): Promise<void> {
  await $.state.set(VIEW, { isOpen, activeView, mode: panes ? 'panes' : 'embed' })
}

async function syncViewPane($: any, activeView: SddViewId | null): Promise<void> {
  if (!panes) return
  if (activeView) await $.ui.open({ id: 'sdd-view', title: NAV.find(n => n.id === activeView)?.name ?? 'SDD view' })
  else await $.ui.close({ id: 'sdd-view' })
}

async function select($: any, id: SddViewId | null): Promise<void> {
  await setView($, true, id)
  await syncViewPane($, id)
}

async function openShell($: any): Promise<boolean> {
  const r = await $.ui.open({ id: 'sdd', title: 'SDD', focus: true, closeOnEscape: true })
  return !!r?.isPlaced
}

function helpText(): string {
  return ['SDD Navigator — views: ' + NAV.map(n => `${n.key}=${n.id}`).join(', '), 'Use /sdd <view>. In the Navigator: 1-9, 0, p open a view; b = Back; Esc = close.', 'Text commands: /sdd-status /sdd-prompt /sdd-run /sdd-review /sdd-analyze /sdd-artifacts /sdd-quality /sdd-trace /sdd-converge /sdd-history'].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd', description: 'Open the SDD Navigator', argumentHint: '[phase|prompt|review|analyze|artifacts|quality|trace|converge|history|control|prompts]' })
    await useDefaultMode($)
    await setView($, false, null)
    await $.state.set(CAPABILITY, { id: 'navigator', version: '0.1.0', status: 'ready' })
    await refreshStatus($)
    return next(e)
  })

  on('command.run', { command: 'sdd' }, async ($, e) => {
    const arg = (e.args ?? '').trim()
    const view = arg ? parseView(arg) : undefined
    if (arg && !view) return { text: `Unknown view "${arg}".\n${helpText()}` }
    const placed = await openShell($)
    await select($, view ?? null)
    await refreshStatus($)
    if (!placed) return { text: `The SDD pane could not be shown here (terminal too narrow, or no pane surface).\n${helpText()}` }
    return { text: view ? `SDD Navigator: ${view}` : 'SDD Navigator opened.' }
  })

  // Esc / the close mark / $.ui.close: whole Navigator pane closes (Esc is never remapped to Back).
  on('ui.close', { id: 'sdd' }, async ($, e, next) => {
    const r = await next(e)
    await setView($, false, null)
    if (panes) { try { await $.ui.close({ id: 'sdd-view' }) } catch { /* already closed */ } }
    return r
  })

  on('state.set', { plugin: 'sdd-control-plane', key: 'control' }, async ($, e, next) => { const r = await next(e); await refreshStatus($); return r })
  on('state.set', { plugin: 'sdd-phase-tracker', key: 'phase' }, async ($, e, next) => { const r = await next(e); await refreshStatus($); return r })
  on('state.set', { plugin: 'sdd-convergence-tracker', key: 'convergence' }, async ($, e, next) => { const r = await next(e); await refreshStatus($); return r })
  on('turn.complete', async ($, e, next) => { await refreshStatus($); return next(e) })

  // The shell. The Navigator MUST be the outer hook for the embedded view slot: it awaits the hooks beneath it and embeds their tree.
  on('ui.render', { component: 'Pane', requestId: 'sdd' }, async ($, e, next) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const view = (await $.state.get(VIEW)).value
    const active = view?.activeView ?? null
    const cap = await caps($)
    const entry = NAV.find(n => n.id === active)
    const unavailable = !!entry && isUnavailable(cap[entry.capability])
    let body: any = null
    let hint: string | undefined
    if (entry && !unavailable && !panes) {
      try { body = await next(e) } catch { body = null }
      if (!containsView(body)) {
        hint = `${entry.name} is ready but its view did not render in the shell (plugin hook order). Switching to one-pane-at-a-time mode.`
        body = null
        $.clock.after(0, async () => { panes = true; await setView($, true, active); await syncViewPane($, active) })
      }
    }
    const narrow = e.props.bodyColumns < 72
    const button = (n: (typeof NAV)[number]) => {
      const off = isUnavailable(cap[n.capability])
      return <Button key={'nav-' + n.id} label={off ? `[${n.label} unavailable]` : n.label} hotkey={n.key} variant={active === n.id ? 'primary' : undefined} onPress={() => select($, n.id)} />
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection={narrow ? 'column' : 'row'}>
          <Text bold>SDD </Text>
          {narrow ? NAV.map(button) : <Box flexDirection="column"><Box flexDirection="row">{NAV.slice(0, 6).map(button)}</Box><Box flexDirection="row">{NAV.slice(6).map(button)}</Box></Box>}
        </Box>
        <Box flexDirection="row">
          {active ? <Button key="nav-back" label="Back" hotkey="b" onPress={() => select($, null)} /> : null}
          <Button key="nav-close" label="× Close" role="dismiss" onPress={() => $.ui.close({ id: 'sdd' })} />
        </Box>
        {!active && <Text dimColor>Select a capability: 1-9, 0, p (focus-scoped keys; buttons work without them). Esc closes. Back is b.</Text>}
        {entry && unavailable && <Box flexDirection="column">{unavailableText(entry, cap[entry.capability]).map((l, n) => <Text key={String(n)}>{l}</Text>)}</Box>}
        {hint && <Text>{hint}</Text>}
        {entry && !unavailable && panes && <Text dimColor>{`The ${entry.name} view is open in its own pane (one view at a time).`}</Text>}
        {body}
      </Box>
    )
  })
}
