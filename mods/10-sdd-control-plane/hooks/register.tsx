import type { Register } from 'claude-code'
import { parseConfig } from './shared/config'
import { deriveControl, formatControl, validateConfigDraft, KNOWN_SECTIONS } from './lib/control'

const CONTROL = { plugin: 'sdd-control-plane', key: 'control' } as const
const CAPABILITY = { plugin: 'sdd-control-plane', key: 'capability' } as const
const PHASE = { plugin: 'sdd-phase-tracker', key: 'phase' } as const
const REVIEW = { plugin: 'sdd-prompt-review', key: 'review' } as const
const ANALYZE = { plugin: 'sdd-analyze-gate', key: 'analyze' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const QUALITY = { plugin: 'sdd-quality-gate', key: 'quality' } as const
const TRACE = { plugin: 'sdd-traceability', key: 'trace' } as const
const CONVERGENCE = { plugin: 'sdd-convergence-tracker', key: 'convergence' } as const
const HISTORY = { plugin: 'sdd-session-history', key: 'history' } as const
const CAP_NAV = { plugin: 'sdd-navigator', key: 'capability' } as const
const CAP_PHASE = { plugin: 'sdd-phase-tracker', key: 'capability' } as const
const CAP_PROMPT = { plugin: 'sdd-prompt-manager', key: 'capability' } as const
const CAP_REVIEW = { plugin: 'sdd-prompt-review', key: 'capability' } as const
const CAP_ANALYZE = { plugin: 'sdd-analyze-gate', key: 'capability' } as const
const CAP_ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'capability' } as const
const CAP_QUALITY = { plugin: 'sdd-quality-gate', key: 'capability' } as const
const CAP_TRACE = { plugin: 'sdd-traceability', key: 'capability' } as const
const CAP_CONVERGE = { plugin: 'sdd-convergence-tracker', key: 'capability' } as const
const CAP_HISTORY = { plugin: 'sdd-session-history', key: 'capability' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

const CONFIG_MARKER = '<!-- sdd-config-edit -->'
const CONFIG_SKELETON = KNOWN_SECTIONS.map(s => `${s}:\n  # enabled: true`).join('\n') + '\n'
let configDraft: string | undefined // transient: only written by an explicit, confirmed Save

async function recompute($: any): Promise<void> {
  const c = deriveControl({
    phase: (await $.state.get(PHASE)).value, review: (await $.state.get(REVIEW)).value, analyze: (await $.state.get(ANALYZE)).value,
    artifacts: (await $.state.get(ARTIFACTS)).value, quality: (await $.state.get(QUALITY)).value, trace: (await $.state.get(TRACE)).value,
    convergence: (await $.state.get(CONVERGENCE)).value, history: (await $.state.get(HISTORY)).value, at: await $.clock.now(),
  })
  await $.state.set(CONTROL, c)
}

async function capabilityLines($: any): Promise<string[]> {
  const caps: [string, any][] = [
    ['① phase', (await $.state.get(CAP_PHASE)).value], ['② prompt', (await $.state.get(CAP_PROMPT)).value], ['③ review', (await $.state.get(CAP_REVIEW)).value],
    ['④ analyze', (await $.state.get(CAP_ANALYZE)).value], ['⑤ artifacts', (await $.state.get(CAP_ARTIFACTS)).value], ['⑥ quality', (await $.state.get(CAP_QUALITY)).value],
    ['⑦ trace', (await $.state.get(CAP_TRACE)).value], ['⑧ converge', (await $.state.get(CAP_CONVERGE)).value], ['⑨ history', (await $.state.get(CAP_HISTORY)).value],
    ['navigator', (await $.state.get(CAP_NAV)).value],
  ]
  return caps.map(([name, c]) => `${name.padEnd(12)} ${c ? c.status : 'unavailable'}${c?.reason ? ' — ' + c.reason : ''}`)
}

async function configText($: any): Promise<string> {
  const root: string = await $.session.root()
  const p = `${root}/.speckit/mod/config.yaml`
  try { return (await $.fs.exists(p)) ? String(await $.fs.read(p)) : '' } catch { return '' }
}

// Delegation only. $.command.run must not be called inside an awaited hook, so this is used from Button presses.
async function delegate($: any, command: string, args: string, fallback: string): Promise<void> {
  try { await $.command.run({ command, args }) } catch { $.ui.toast(fallback) }
}

async function editConfig($: any): Promise<string> {
  const current = await configText($)
  await $.prompt.fill({ text: `${CONFIG_MARKER}\n${current || CONFIG_SKELETON}`, mode: 'replace' })
  return 'The configuration is in the composer (keep the first line). Press Enter to capture it — it is NOT sent. Then use Save configuration.'
}

async function saveConfig($: any): Promise<string> {
  if (configDraft === undefined) return 'No captured configuration edit. Use Edit configuration first.'
  const problem = validateConfigDraft(configDraft, parseConfig(configDraft))
  if (problem) return `Not saved: ${problem}.`
  let ok = false
  try { ok = (await $.ui.ask('Write the captured text to .speckit/mod/config.yaml? Each Mod validates its own section.', ['Yes', 'No'])) === 'Yes' } catch { ok = false }
  if (!ok) return 'Not saved (no confirmation).'
  const root: string = await $.session.root()
  await $.fs.write(`${root}/.speckit/mod/config.yaml`, configDraft)
  configDraft = undefined
  return 'Configuration saved. Mods re-read their own sections; any problem appears as a degraded capability above.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set(CAPABILITY, { id: 'control', version: '0.1.0', status: 'ready' })
    await recompute($)
    return next(e)
  })

  // Aggregate by observing owners' writes (Spike B verified in the harness); turn.complete re-derives as the fallback.
  on('state.set', { plugin: 'sdd-phase-tracker', key: 'phase' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-prompt-review', key: 'review' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-analyze-gate', key: 'analyze' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-artifact-tracker', key: 'artifacts' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-quality-gate', key: 'quality' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-traceability', key: 'trace' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-convergence-tracker', key: 'convergence' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-session-history', key: 'history' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('turn.complete', async ($, e, next) => { await recompute($); return next(e) })

  // Captures a configuration draft typed into the composer; never sent to the model.
  on('prompt.submit', { text: /^\s*<!-- sdd-config-edit -->/ }, async ($, e, next) => {
    if (e.origin?.kind !== 'composer' || !e.text.trimStart().startsWith(CONFIG_MARKER)) return next(e)
    configDraft = e.text.trimStart().slice(CONFIG_MARKER.length).replace(/^\n/, '')
    return { drop: 'Configuration draft captured, not sent. Use Save configuration in ⑩ Control.' }
  })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'control' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const c = (await $.state.get(CONTROL)).value
    const caps = await capabilityLines($)
    const cfg = parseConfig(await configText($))
    const next_ = c?.nextAction
    return (
      <Box flexDirection="column">
        <Text bold>SDD / CONTROL PLANE (aggregate · delegates only)</Text>
        {formatControl(c).map((l, n) => <Text key={String(n)}>{l}</Text>)}
        <Text bold>Capabilities</Text>
        {caps.map(l => <Text key={l}>{l}</Text>)}
        <Text bold>Configuration (.speckit/mod/config.yaml)</Text>
        <Text>{Object.keys(cfg).length ? `sections: ${Object.keys(cfg).join(', ')}` : 'no configuration file (defaults apply)'}</Text>
        <Button key="ctl-next" label="Do next action (opens its owner)" hotkey="n" variant="primary" onPress={() => delegate($, 'sdd', next_?.viewId ?? 'phase', 'Open the owner view with /sdd ' + (next_?.viewId ?? 'phase'))} />
        <Button key="ctl-run" label="Run via ③" hotkey="r" onPress={() => delegate($, 'sdd-run', (c?.summary.phase && c.summary.phase !== 'unknown') ? c.summary.phase : (c?.summary.nextPhase ?? ''), 'Use /sdd-run <phase>')} />
        <Button key="ctl-analyze" label="Analyze via ③" hotkey="a" onPress={() => delegate($, 'sdd-run', 'analyze', 'Use /sdd-run analyze')} />
        <Button key="ctl-findings" label="Review findings ④" hotkey="f" onPress={() => delegate($, 'sdd', 'analyze', 'Use /sdd analyze')} />
        <Button key="ctl-decide" label="Approve / Reject ⑥" hotkey="q" onPress={() => delegate($, 'sdd', 'quality', 'Use /sdd quality')} />
        <Button key="ctl-edit-config" label="Edit configuration" hotkey="e" onPress={async () => { $.ui.toast(await editConfig($)) }} />
        <Button key="ctl-save-config" label="Save configuration" hotkey="w" onPress={async () => { $.ui.toast(await saveConfig($)) }} />
      </Box>
    )
  })
}
