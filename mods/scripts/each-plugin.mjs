// Runs one tool over every plugin folder: `tsc` (local TypeScript), `validate`, or `test` (actual claude CLI).
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
const only = process.argv[3]
const plugins = readdirSync(root).filter(d => /^(0\d|10|11)-/.test(d) && (!only || d.startsWith(only)))
let failed = 0
for (const p of plugins) {
  const dir = join(root, p)
  const [cmd, args] =
    mode === 'tsc' ? [join(root, 'node_modules/.bin/tsc'), ['-p', dir, '--noEmit']]
    : mode === 'validate' ? ['claude', ['plugin', 'validate', dir]]
    : ['claude', ['plugin', 'test', dir]]
  if (mode === 'tsc' && p.startsWith('11-')) continue // content-only: nothing to type-check
  if (mode === 'test' && p.startsWith('11-')) continue
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  const ok = r.status === 0
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${mode} ${p}`)
  if (!ok || process.env.VERBOSE) console.log((r.stdout + r.stderr).split('\n').slice(0, 40).join('\n'))
}
process.exit(failed ? 1 : 0)
