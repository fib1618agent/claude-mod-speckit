// Minimal reader for .speckit/mod/config.yaml: `ns:` top-level sections with indented `key: value` scalars.
// Values may be `a, b, c` lists. Anything fancier (anchors, nested maps) is intentionally unsupported.
export type ConfigSection = Record<string, string>

export function parseConfig(text: string): Record<string, ConfigSection> {
  const out: Record<string, ConfigSection> = {}
  let ns: string | undefined
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').replace(/\r$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue
    const top = /^([A-Za-z][\w-]*):\s*$/.exec(line)
    if (top && top[1]) { ns = top[1]; out[ns] = out[ns] ?? {}; continue }
    const kv = /^\s+([A-Za-z][\w.-]*):\s*(.*)$/.exec(line)
    if (kv && kv[1] && ns) {
      const sec = (out[ns] = out[ns] ?? {})
      sec[kv[1]] = (kv[2] ?? '').trim().replace(/^["']|["']$/g, '')
    }
  }
  return out
}

export function section(cfg: Record<string, ConfigSection>, ns: string): ConfigSection {
  return cfg[ns] ?? {}
}

export function bool(v: string | undefined, dflt: boolean): boolean {
  if (v === undefined) return dflt
  return /^(true|yes|on|1)$/i.test(v)
}

export function list(v: string | undefined): string[] {
  return (v ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

export function int(v: string | undefined, dflt: number): number {
  const n = Number(v)
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : dflt
}
