// Copies mods/_shared/*.ts into every code plugin's hooks/shared/ (plugins cannot import across folders).
// `--check` fails when a copy drifted, and when the per-Mod `SddCapability` contract type differs between plugins.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const plugins = readdirSync(root).filter(d => /^(0\d|10)-/.test(d))
const shared = readdirSync(join(root, '_shared')).filter(f => f.endsWith('.ts'))
let bad = 0
for (const p of plugins) {
  const dir = join(root, p, 'hooks', 'shared')
  for (const f of shared) {
    const src = readFileSync(join(root, '_shared', f), 'utf8')
    const dst = join(dir, f)
    if (check) {
      if (!existsSync(dst) || readFileSync(dst, 'utf8') !== src) { console.error('DRIFT', p, f); bad++ }
    } else { mkdirSync(dir, { recursive: true }); writeFileSync(dst, src) }
  }
}
if (check) {
  const caps = new Map()
  for (const p of plugins) {
    const t = join(root, p, 'types', 'index.d.ts')
    if (!existsSync(t)) continue
    const m = /export type SddCapability = [^;]*;/.exec(readFileSync(t, 'utf8'))
    if (m) caps.set(p, m[0])
  }
  if (new Set(caps.values()).size > 1) { console.error('SddCapability differs across contracts'); bad++ }
  console.log(`checked ${plugins.length} plugins, ${caps.size} capability contracts`)
  process.exit(bad ? 1 : 0)
}
console.log(`synced ${shared.length} shared files into ${plugins.length} plugins`)
