import { randomBytes } from 'node:crypto'

export function makeSlug() {
  return randomBytes(6).toString('base64url').toLowerCase()
}
