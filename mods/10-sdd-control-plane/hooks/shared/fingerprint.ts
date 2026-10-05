// Non-cryptographic content fingerprint (two FNV-1a 32-bit lanes). Used to detect change, never for security.
export function fingerprint(text: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ (c + i), 0x85ebca6b) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

// $.store is per plugin and per user, NOT project-scoped; project-keyed records derive their key from the project root.
export function projectKey(root: string): string {
  return 'p-' + fingerprint(root)
}
