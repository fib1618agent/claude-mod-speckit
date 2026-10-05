import type { Register } from 'claude-code'
import { parseConfig, section } from './shared/config'
import { resolvePhaseModel } from './shared/phases'
import { derivePhase, formatPhase } from './lib/derive'

const PHASE = { plugin: 'sdd-phase-tracker', key: 'phase' } as const
const CAPABILITY = { plugin: 'sdd-phase-tracker', key: 'capability' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

async function phaseModel($: any): Promise<string[]> {
  const root: string = await $.session.root()
  let cfgText = ''
  try { const p = `${root}/.speckit/mod/config.yaml`; if (await $.fs.exists(p)) cfgText = String(await $.fs.read(p)) } catch { /* no config */ }
  const names: string[] = []
  for (const dir of ['.claude/skills', '.claude/commands']) {
    try { for (const x of await $.fs.list(`${root}/${dir}`)) names.push(x.name) } catch { /* absent */ }
  }
  return resolvePhaseModel((section(parseConfig(cfgText), 'phase').model ?? '').split(',').map((s: string) => s.trim()).filter(Boolean), names)
}

// Re-derives from the 05 inventory only: 01 never walks the file system for artifacts.
async function recompute($: any): Promise<void> {
  const inv = (await $.state.get(ARTIFACTS)).value
  const phase = derivePhase(await phaseModel($), inv, await $.clock.now())
  await $.state.set(PHASE, phase)
  await $.state.set(CAPABILITY, inv ? { id: 'phase', version: '0.1.0', status: 'ready' } : { id: 'phase', version: '0.1.0', status: 'degraded', reason: 'Artifact Tracker (05) has published no inventory; phase is unknown' })
}

async function confirm($: any, question: string): Promise<boolean> {
  try { return (await $.ui.ask(question, ['Yes', 'No'])) === 'Yes' } catch { return false }
}

async function statusText($: any): Promise<string> {
  await recompute($)
  return formatPhase((await $.state.get(PHASE)).value)
}

async function hasNavigator($: any): Promise<boolean> {
  try { return (await $.command.list()).some((c: any) => c.name === 'sdd') } catch { return false }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-status', description: 'SDD phase status (alias of the Navigator Phase view)', argumentHint: '[refresh|reset]' })
    await recompute($)
    return next(e)
  })

  // Alias: with the Navigator present open ① (deferred: $.command.run must not run inside this awaited hook); otherwise print text.
  on('command.run', { command: 'sdd-status' }, async ($, e) => {
    const arg = (e.args ?? '').trim()
    if (arg === 'reset') {
      if (!(await confirm($, 'Clear the cached SDD phase state? (No Spec-Kit files are touched.)'))) return { text: 'Not reset (no confirmation).' }
      await $.state.set(PHASE, { current: null, next: null, phases: [], at: await $.clock.now(), reason: 'reset; run /sdd-status refresh' })
      return { text: 'Phase state cleared. Run /sdd-status refresh.' }
    }
    if (arg !== 'refresh' && (await hasNavigator($))) {
      $.clock.after(0, async () => { try { await $.command.run({ command: 'sdd', args: 'phase' }) } catch { /* Navigator could not open: text fallback already available */ } })
      return { text: 'Opening the SDD Navigator at ① Phase… (use /sdd-status refresh for text)' }
    }
    return { text: await statusText($) }
  })

  // Observe the inventory owner's writes (Spike B: verified in the harness); turn.complete is the re-derive fallback.
  on('state.set', { plugin: 'sdd-artifact-tracker', key: 'artifacts' }, async ($, e, next) => {
    const ran = await next(e)
    await recompute($)
    return ran
  })
  on('turn.complete', async ($, e, next) => {
    await recompute($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'phase' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = (await $.state.get(PHASE)).value
    return (
      <Box flexDirection="column">
        <Text bold>SDD / PHASE</Text>
        {!p && <Text dimColor>No phase information yet.</Text>}
        {p && formatPhase(p).split('\n').map(l => <Text key={l}>{l}</Text>)}
        <Button key="phase-refresh" label="Refresh" hotkey="r" onPress={() => recompute($)} />
      </Box>
    )
  })
}
