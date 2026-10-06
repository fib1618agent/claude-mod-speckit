import type { Register } from 'claude-code'
import type { InterceptionPath } from '../types'
import { fingerprint } from './shared/fingerprint'
import { parseConfig, section, bool, list } from './shared/config'
import { resolvePhaseModel } from './shared/phases'
import { EDIT_MARKER, ensureHeader, gateBlock, isHuman, parseEditCopy, phaseOfCommand, phaseOfText, preview } from './lib/review'

const REVIEW = { plugin: 'sdd-prompt-review', key: 'review' } as const
const CAPABILITY = { plugin: 'sdd-prompt-review', key: 'capability' } as const
const PROMPT_RES = { plugin: 'sdd-prompt-manager', key: 'promptResolution' } as const
const QUALITY = { plugin: 'sdd-quality-gate', key: 'quality' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

type Pending = {
  requestId: string; phase: string; args: string; path: InterceptionPath
  ready: boolean; composed: string; edited: boolean
  templateId: string; version: string; access: string
}
// Review progress is this Mod's own session state. There is exactly ONE pending review and ONE decision flow;
// the interception hooks below only call requestReview(): none of them carries approval logic.
let pending: Pending | undefined
let running: string | undefined // phase of the approved execution until its turn completes (never re-intercepted while it runs)
let seq = 0

async function settings($: any): Promise<{ enabled: boolean; phases: string[] }> {
  const root: string = await $.session.root()
  let text = ''
  try { const p = `${root}/.speckit/mod/config.yaml`; if (await $.fs.exists(p)) text = String(await $.fs.read(p)) } catch { /* no config */ }
  const cfg = parseConfig(text)
  const r = section(cfg, 'review')
  const names: string[] = []
  for (const dir of ['.claude/skills', '.claude/commands']) { try { for (const x of await $.fs.list(`${root}/${dir}`)) names.push(x.name) } catch { /* absent */ } }
  return { enabled: bool(r.enabled, true) && bool(r.reviewBeforeRun, true), phases: resolvePhaseModel(list(section(cfg, 'phase').model), names) }
}

async function publish($: any, patch: Partial<{ phase: string; promptHash: string; state: 'pending' | 'approved' | 'cancelled'; requestId: string; path: InterceptionPath; reason: string; edited: boolean }>): Promise<void> {
  const prev = (await $.state.get(REVIEW)).value
  await $.state.set(REVIEW, { phase: '', promptHash: '', state: 'cancelled', requestId: '', path: 'sdd-run', ...(prev ?? {}), ...patch, reason: patch.reason, at: await $.clock.now() })
}

async function fail($: any, reason: string): Promise<void> {
  const p = pending
  pending = undefined
  await publish($, { phase: p?.phase, state: 'cancelled', reason })
  $.ui.toast(`SDD review cancelled: ${reason}`.slice(0, 140))
}

async function hasNavigator($: any): Promise<boolean> {
  try { return (await $.command.list()).some((c: any) => c.name === 'sdd') } catch { return false }
}

async function gateOf($: any, phase: string) {
  const g = (await $.state.get(QUALITY)).value?.gates?.[phase]
  return g ? { display: g.display, status: g.status, blockers: g.blockers, warnings: g.warnings } : undefined
}

// THE single entry for every interception path. Answers quickly (callers are awaited hooks) and defers all cross-plugin work.
async function requestReview($: any, phase: string, args: string, path: InterceptionPath): Promise<string> {
  if (pending) return pending.phase === phase ? `A review for "${phase}" is already pending: open ③ Review (or /sdd-review).` : `Another review ("${pending.phase}") is pending: finish or cancel it first (/sdd-review).`
  const requestId = `r${await $.clock.now()}-${++seq}`
  pending = { requestId, phase, args, path, ready: false, composed: '', edited: false, templateId: '', version: '', access: 'unknown' }
  await publish($, { phase, promptHash: '', state: 'pending', requestId, path, reason: undefined, edited: false })
  $.clock.after(0, () => beginReview($, requestId))
  return `SDD review required before running "${phase}": the prompt is being composed. Nothing runs until you approve it${path === 'sdd-run' ? '' : ' (this request was not sent to the model)'}.`
}

async function beginReview($: any, requestId: string): Promise<void> {
  const p = pending
  if (!p || p.requestId !== requestId) return
  try { await $.command.run({ command: 'sdd-prompt', args: `resolve ${requestId} ${p.phase} ${p.args}`.trim() }) }
  catch (err: any) { return fail($, 'Prompt Manager is unavailable (' + String(err?.message ?? err).slice(0, 80) + '); nothing was run') }
  const res = (await $.state.get(PROMPT_RES)).value
  if (!res || res.requestId !== requestId) return fail($, 'no prompt resolution was produced for this request; nothing was run')
  if (res.status === 'blocked') return fail($, `blocked: ${res.reason}`)
  p.composed = ensureHeader(res.composed ?? '', p.phase)
  p.templateId = res.templateId; p.version = res.version; p.access = res.access; p.ready = true
  await publish($, { phase: p.phase, promptHash: fingerprint(p.composed), state: 'pending', requestId, path: p.path, edited: false })
  if (await hasNavigator($)) { try { await $.command.run({ command: 'sdd', args: 'review' }); return } catch { /* fall through to the dialog */ } }
  await askApproval($)
}

// Fallback when no card can be drawn: an explicit dialog. If it cannot be answered (e.g. -p) the review fails CLOSED.
async function askApproval($: any): Promise<void> {
  const p = pending
  if (!p || !p.ready) return
  const gate = await gateOf($, p.phase)
  const blocked = gateBlock(gate)
  const q = `Run the reviewed "${p.phase}" prompt (${p.composed.length} chars, ${p.access})?${blocked ? ' BLOCKED — ' + blocked : ''}`
  let answer: string
  try { answer = await $.ui.ask(q, blocked ? ['Cancel', 'Edit'] : ['Run', 'Edit', 'Cancel']) } catch { return fail($, 'no way to ask for approval here; nothing was run (fail closed)') }
  if (answer === 'Run') $.ui.toast(await approveRun($))
  else if (answer === 'Edit') $.ui.toast(await editCopy($))
  else await fail($, 'cancelled by the user')
}

async function approveRun($: any): Promise<string> {
  const p = pending
  if (!p) return 'No prompt pending.'
  if (!p.ready) return 'The prompt is still being composed.'
  const blocked = gateBlock(await gateOf($, p.phase))
  if (blocked) return `Run blocked. ${blocked}`
  const text = ensureHeader(p.composed, p.phase)
  pending = undefined
  running = p.phase
  await publish($, { phase: p.phase, promptHash: fingerprint(text), state: 'approved', requestId: p.requestId, path: p.path, edited: p.edited, reason: undefined })
  // Deferred and not awaited here: $.prompt.submit resolves when the turn starts, which cannot happen inside an awaited hook.
  $.clock.after(0, async () => {
    try { await $.prompt.submit({ text, asUser: true }) } catch (err: any) { running = undefined; $.ui.toast('Reviewed prompt could not be submitted: ' + String(err?.message ?? err).slice(0, 80)) }
  })
  return `Approved: running the reviewed "${p.phase}" prompt.`
}

async function cancelReview($: any): Promise<string> {
  if (!pending) return 'No prompt pending.'
  await fail($, 'cancelled by the user')
  return 'Cancelled: nothing was run.'
}

// Edits the per-run EXECUTION COPY. The single-line Input cannot hold a prompt, so the copy goes through the composer.
async function editCopy($: any): Promise<string> {
  const p = pending
  if (!p || !p.ready) return 'No prompt pending.'
  await $.prompt.fill({ text: `${EDIT_MARKER(p.requestId)}\n${p.composed}`, mode: 'replace' })
  return 'The execution copy is in the composer (keep the first line). Press Enter to capture your edit — it is NOT sent. Then press Run in ③ Review or run /sdd-review run. Template files are not changed.'
}

async function saveTemplate($: any): Promise<string> {
  const p = pending
  if (!p) return 'No prompt pending.'
  // Persistent template edit/save belongs to 02 (confirmation happens there); edits to this run's copy are not saved automatically.
  $.clock.after(0, async () => { try { await $.command.run({ command: 'sdd-prompt', args: `edit ${p.phase}` }) } catch { $.ui.toast('Prompt Manager is unavailable') } })
  return `Opening the "${p.phase}" template for editing in the Prompt Manager. Save it there with /sdd-prompt save ${p.phase}. Edits made to this run's copy are not saved as the template.`
}

async function statusText($: any): Promise<string> {
  const r = (await $.state.get(REVIEW)).value
  if (pending) {
    const gate = await gateOf($, pending.phase)
    return `Review pending: ${pending.phase} (${pending.path})${pending.ready ? `\nTemplate: ${pending.templateId} v${pending.version}, access ${pending.access}${pending.edited ? ', EDITED' : ''}\nGate: ${gate ? gate.display : 'no gate evidence'}${gateBlock(gate) ? ' — Run blocked' : ''}\n\n${preview(pending.composed, 800)}\n\nApprove with /sdd-review run, or /sdd-review edit | cancel.` : ' — composing…'}`
  }
  return r ? `No prompt pending.\nLast review: ${r.phase || '-'} ${r.state}${r.reason ? ' (' + r.reason + ')' : ''}` : 'No prompt pending.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-run', description: 'Review, then run, a Spec-Kit phase through the SDD Review Gate', argumentHint: '<phase> [arguments]' })
    await $.command.register({ name: 'sdd-review', description: 'Show or decide the pending SDD prompt review', argumentHint: '[run|edit|cancel|save]' })
    await $.state.set(CAPABILITY, { id: 'review', version: '0.1.0', status: 'ready' })
    return next(e)
  })

  // PATH 1 (preferred for typed commands): the earliest point. Answering {text} without next stops the normal model call.
  on('command.run', { command: /^speckit[-.]/i }, async ($, e, next) => {
    const set = await settings($)
    const phase = phaseOfCommand(e.command, set.phases)
    if (!phase || !set.enabled || running === phase) return next(e)
    return { text: await requestReview($, phase, (e.args ?? '').trim(), 'command') }
  })

  on('command.run', { command: 'sdd-run' }, async ($, e) => {
    const [phase = '', ...rest] = (e.args ?? '').trim().split(/\s+/)
    const set = await settings($)
    if (!phase) return { text: 'Usage: /sdd-run <phase> [arguments]' }
    if (!set.phases.includes(phase)) return { text: `"${phase}" is not in the discovered Spec-Kit phase set (${set.phases.join(', ')}).` }
    return { text: await requestReview($, phase, rest.join(' '), 'sdd-run') }
  })

  on('command.run', { command: 'sdd-review' }, async ($, e) => {
    const sub = (e.args ?? '').trim()
    // Approval-class actions need a human origin: a program (-p, SDK, another plugin) cannot approve. Fail closed.
    if ((sub === 'run' || sub === 'cancel' || sub === 'edit' || sub === 'save') && !isHuman(e.origin)) return { text: `Not done: "${sub}" must be typed by a person in an interactive session (origin ${e.origin?.kind ?? 'unknown'}). Nothing was run.` }
    if (sub === 'run') return { text: await approveRun($) }
    if (sub === 'cancel') return { text: await cancelReview($) }
    if (sub === 'edit') return { text: await editCopy($) }
    if (sub === 'save') return { text: await saveTemplate($) }
    return { text: await statusText($) }
  })

  // PATH 2 (backstop): raw typed text that reached the prompt without being caught at command.run; also captures execution-copy edits.
  on('prompt.submit', { text: /^\s*(\/speckit|<!--\s*sdd-review-edit:)/i }, async ($, e, next) => {
    const edit = parseEditCopy(e.text)
    if (edit && pending && pending.requestId === edit.id && e.origin?.kind === 'composer') {
      pending.composed = ensureHeader(edit.body, pending.phase)
      pending.edited = true
      await publish($, { phase: pending.phase, promptHash: fingerprint(pending.composed), state: 'pending', requestId: pending.requestId, path: pending.path, edited: true })
      return { drop: 'Edited copy captured, not sent. Press Run in ③ Review (or /sdd-review run) to run it after review.' }
    }
    const set = await settings($)
    const hit = set.enabled ? phaseOfText(e.text, set.phases) : undefined
    if (!hit || running === hit.phase) return next(e)
    const msg = await requestReview($, hit.phase, hit.args, 'prompt')
    return { drop: msg }
  })

  // PATH 3: a model-invoked Spec-Kit skill. Same single flow; the call is denied and the user decides at the review.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const set = await settings($)
    const phase = set.enabled ? phaseOfCommand(String((e as { skill?: string }).skill ?? ''), set.phases) : undefined
    if (!phase || running === phase) return next(e)
    return { deny: await requestReview($, phase, String((e as { args?: string }).args ?? ''), 'tool') }
  })

  on('turn.complete', async ($, e, next) => {
    if (running && !e.agentId) running = undefined
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'review' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const last = (await $.state.get(REVIEW)).value
    if (!pending) {
      return (
        <Box flexDirection="column">
          <Text bold>SDD / REVIEW</Text>
          <Text>No prompt pending</Text>
          {last ? <Text dimColor>{`Last review: ${last.phase || '-'} ${last.state}${last.reason ? ' (' + last.reason + ')' : ''}`}</Text> : null}
          <Text dimColor>Start one with /sdd-run &lt;phase&gt; or a Spec-Kit command.</Text>
        </Box>
      )
    }
    const p = pending
    const gate = await gateOf($, p.phase)
    const blocked = gateBlock(gate)
    return (
      <Box flexDirection="column">
        <Text bold>{`SDD / REVIEW — ${p.phase}`}</Text>
        {!p.ready && <Text dimColor>Composing the prompt…</Text>}
        {p.ready && <Text>{`Template ${p.templateId} v${p.version} · ${p.access === 'read-only' ? 'READ-ONLY phase' : p.access === 'modifies-files' ? 'MAY MODIFY FILES' : 'access unknown'} · ${p.composed.length} chars${p.edited ? ' · EDITED' : ''}`}</Text>}
        <Text>{`Quality gate: ${gate ? gate.display : 'no gate evidence'}`}</Text>
        {blocked && <Text>{`Run blocked — ${blocked}`}</Text>}
        {p.ready && !blocked && <Button key="review-run" label="Run" hotkey="r" variant="primary" onPress={async () => { $.ui.toast(await approveRun($)) }} />}
        <Button key="review-edit" label="Edit Prompt" hotkey="e" onPress={async () => { $.ui.toast(await editCopy($)) }} />
        <Button key="review-cancel" label="Cancel" hotkey="c" onPress={async () => { $.ui.toast(await cancelReview($)) }} />
        <Button key="review-save" label="Save Template" hotkey="s" onPress={async () => { $.ui.toast(await saveTemplate($)) }} />
        {p.ready && <Text dimColor>{preview(p.composed, 400)}</Text>}
      </Box>
    )
  })
}
