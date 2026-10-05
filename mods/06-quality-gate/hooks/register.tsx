import type { Register } from 'claude-code'
import type { Approval } from '../types'
import { projectKey } from './shared/fingerprint'
import { parseConfig, section, bool, list } from './shared/config'
import { resolvePhaseModel } from './shared/phases'
import { decide, evaluateAll, formatQuality, type Decision, type GateConfig } from './lib/gates'

const QUALITY = { plugin: 'sdd-quality-gate', key: 'quality' } as const
const CAPABILITY = { plugin: 'sdd-quality-gate', key: 'capability' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const ANALYZE = { plugin: 'sdd-analyze-gate', key: 'analyze' } as const
const TRACE = { plugin: 'sdd-traceability', key: 'trace' } as const
const PHASE = { plugin: 'sdd-phase-tracker', key: 'phase' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

// Approvals are metadata only; $.store is per user, so they are keyed by project.
let approvals: Record<string, Approval> = {}

async function load($: any): Promise<{ phases: string[]; cfg: GateConfig; root: string }> {
  const root: string = await $.session.root()
  let text = ''
  try { const p = `${root}/.speckit/mod/config.yaml`; if (await $.fs.exists(p)) text = String(await $.fs.read(p)) } catch { /* no config */ }
  const parsed = parseConfig(text)
  const q = section(parsed, 'quality')
  const names: string[] = []
  for (const dir of ['.claude/skills', '.claude/commands']) { try { for (const x of await $.fs.list(`${root}/${dir}`)) names.push(x.name) } catch { /* absent */ } }
  return {
    root,
    phases: resolvePhaseModel(list(section(parsed, 'phase').model), names),
    cfg: { analyzeRequiredBeforeImplement: bool(q.analyzeRequiredBeforeImplement, true), approvalRequired: list(q.approvalRequired), scoreFormula: q.scoreFormula || undefined },
  }
}

async function evaluate($: any): Promise<void> {
  const { phases, cfg, root } = await load($)
  const saved = (await $.store.get('approvals:' + projectKey(root))) as Record<string, Approval> | undefined
  approvals = saved ?? approvals
  const q = evaluateAll({
    phases, cfg, approvals, at: await $.clock.now(),
    artifacts: (await $.state.get(ARTIFACTS)).value, analyze: (await $.state.get(ANALYZE)).value, trace: (await $.state.get(TRACE)).value,
  })
  await $.state.set(QUALITY, q)
  const inv = (await $.state.get(ARTIFACTS)).value
  await $.state.set(CAPABILITY, inv
    ? { id: 'quality', version: '0.1.0', status: 'ready' }
    : { id: 'quality', version: '0.1.0', status: 'degraded', reason: 'no artifact inventory: gates report NOT_READY/UNKNOWN rather than passing' })
}

async function confirm($: any, question: string): Promise<boolean> {
  try { return (await $.ui.ask(question, ['Yes', 'No'])) === 'Yes' } catch { return false } // fail closed
}

// The only code path that records Approve / Reject / Continue.
async function decideFor($: any, decision: Decision, phase: string): Promise<string> {
  await evaluate($)
  const { cfg, root } = await load($)
  const q = (await $.state.get(QUALITY)).value
  const outcome = decide(decision, q?.gates[phase], cfg.approvalRequired.includes(phase), await $.clock.now())
  if (!outcome.ok) return `Not recorded: ${outcome.reason}.`
  const verb = decision === 'approved' ? 'Approve' : decision === 'rejected' ? 'Reject' : 'Continue past'
  if (!(await confirm($, `${verb} the "${phase}" quality gate for the current evidence?`))) return 'Not recorded (no confirmation).'
  approvals = { ...approvals, [phase]: outcome.approval }
  await $.store.set('approvals:' + projectKey(root), approvals)
  await evaluate($)
  return `${decision} recorded for gate "${phase}". (Continue does not run the next phase: that still goes through the Review Gate.)`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-quality', description: 'Show SDD quality gates; approve, reject or continue a gate', argumentHint: '[phase] | approve|reject|continue <phase>' })
    await evaluate($)
    return next(e)
  })

  on('command.run', { command: 'sdd-quality' }, async ($, e) => {
    const [a = '', b = ''] = (e.args ?? '').trim().split(/\s+/)
    if (a === 'approve' || a === 'reject' || a === 'continue') {
      if (!b) return { text: `Usage: /sdd-quality ${a} <phase>` }
      return { text: await decideFor($, a === 'approve' ? 'approved' : a === 'reject' ? 'rejected' : 'continued', b) }
    }
    await evaluate($)
    return { text: formatQuality((await $.state.get(QUALITY)).value, a || undefined) }
  })

  // Re-evaluate when any evidence owner writes (Spike B: verified in the harness); turn.complete is the fallback.
  on('state.set', { plugin: 'sdd-artifact-tracker', key: 'artifacts' }, async ($, e, next) => { const r = await next(e); await evaluate($); return r })
  on('state.set', { plugin: 'sdd-analyze-gate', key: 'analyze' }, async ($, e, next) => { const r = await next(e); await evaluate($); return r })
  on('state.set', { plugin: 'sdd-traceability', key: 'trace' }, async ($, e, next) => { const r = await next(e); await evaluate($); return r })
  on('turn.complete', async ($, e, next) => { await evaluate($); return next(e) })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'quality' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const q = (await $.state.get(QUALITY)).value
    const current = (await $.state.get(PHASE)).value?.current ?? undefined
    return (
      <Box flexDirection="column">
        <Text bold>SDD / QUALITY GATE</Text>
        {formatQuality(q).split('\n').map((l, n) => <Text key={String(n)}>{l}</Text>)}
        {current ? (
          <Box flexDirection="column">
            <Text dimColor>{`Decisions apply to the "${current}" gate (current phase). Each asks for confirmation.`}</Text>
            <Button key="q-approve" label="Approve" hotkey="a" variant="primary" onPress={() => decideFor($, 'approved', current)} />
            <Button key="q-reject" label="Reject" hotkey="x" onPress={() => decideFor($, 'rejected', current)} />
            <Button key="q-continue" label="Continue" hotkey="c" onPress={() => decideFor($, 'continued', current)} />
          </Box>
        ) : <Text dimColor>No current phase known: use /sdd-quality approve|reject|continue &lt;phase&gt;.</Text>}
      </Box>
    )
  })
}
