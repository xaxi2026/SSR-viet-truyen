/**
 * Safe SSR ZIP32 restore. Only main-owned file/folder dialogs may invoke this.
 * Verify archive metadata, uncompressed SHA-256 receipts and all paths BEFORE
 * reserving any destination. The destination must not exist.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import Database from 'better-sqlite3'
import { crc32 } from './ssr-project-archive'

const MAX_FILE = 256 * 1024 * 1024
const MAX_TOTAL = 2 * 1024 * 1024 * 1024
const MAX_ENTRIES = 20_000
const MAX_MANIFEST = 2 * 1024 * 1024
const MAX_ARCHIVE = MAX_TOTAL + 32 * 1024 * 1024
const MANIFEST = 'ssr-backup-manifest.json'

type Receipt = { bytes: number; sha256: string }
type Entry = {
  name: string
  localOffset: number
  packedBytes: number
  rawBytes: number
  checksum: number
  method: number
  flags: number
}

export interface VerifiedSsrArchive {
  fileCount: number
  files: ReadonlyArray<{ name: string; bytes: number }>
  projectId: string
}

function safeName(name: string): string[] {
  if (!name || name.length > 1024 || name.startsWith('/') || name.includes('\\')) {
    throw new Error('Unsafe ZIP entry path')
  }
  const parts = name.split('/')
  if (parts.some(part => (
    !part || part === '.' || part === '..' || part.endsWith('.') || /\s$/u.test(part)
    || /[<>:"|?*]/u.test(part) || [...part].some(char => char.charCodeAt(0) < 32)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
  ))) throw new Error('Unsafe ZIP entry path')
  return parts
}

async function readAt(file: fs.FileHandle, count: number, offset: number): Promise<Buffer> {
  if (count < 0 || count > MAX_FILE + 1024 * 1024) throw new Error('Oversized ZIP read')
  const data = Buffer.alloc(count)
  let read = 0
  while (read < count) {
    const chunk = await file.read(data, read, count - read, offset + read)
    if (!chunk.bytesRead) throw new Error('Truncated ZIP archive')
    read += chunk.bytesRead
  }
  return data
}

async function indexArchive(file: fs.FileHandle): Promise<Entry[]> {
  const size = (await file.stat()).size
  if (size < 22 || size > MAX_ARCHIVE) throw new Error('ZIP exceeds supported ZIP32 limits')
  const tailSize = Math.min(size, 65557)
  const tail = await readAt(file, tailSize, size - tailSize)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('ZIP end-of-directory not found')
  if (tail.readUInt16LE(eocd + 4) !== 0 || tail.readUInt16LE(eocd + 6) !== 0
    || tail.readUInt16LE(eocd + 8) !== tail.readUInt16LE(eocd + 10)) {
    throw new Error('Multi-disk ZIP is unsupported')
  }
  const count = tail.readUInt16LE(eocd + 10)
  const centralBytes = tail.readUInt32LE(eocd + 12)
  const centralOffset = tail.readUInt32LE(eocd + 16)
  const centralEnd = size - tail.length + eocd
  if (!count || count > MAX_ENTRIES + 1 || centralOffset + centralBytes !== centralEnd
    || centralOffset > MAX_ARCHIVE || centralBytes > 8 * 1024 * 1024) {
    throw new Error('Unsafe or unsupported ZIP directory')
  }
  const entries: Entry[] = []
  const usedNames = new Set<string>()
  let position = centralOffset
  let totalRaw = 0
  for (let i = 0; i < count; i++) {
    const header = await readAt(file, 46, position)
    if (header.readUInt32LE(0) !== 0x02014b50) throw new Error('Malformed ZIP central entry')
    const flags = header.readUInt16LE(8)
    const method = header.readUInt16LE(10)
    const checksum = header.readUInt32LE(16)
    const packedBytes = header.readUInt32LE(20)
    const rawBytes = header.readUInt32LE(24)
    const nameBytes = header.readUInt16LE(28)
    const extraBytes = header.readUInt16LE(30)
    const commentBytes = header.readUInt16LE(32)
    const localOffset = header.readUInt32LE(42)
    const unixMode = (header.readUInt32LE(38) >>> 16) & 0xf000
    if ((flags & ~0x0808) !== 0 || ![0, 8].includes(method) || unixMode === 0xa000
      || rawBytes > MAX_FILE || packedBytes > MAX_FILE + 1024
      || localOffset === 0xffffffff || rawBytes === 0xffffffff || packedBytes === 0xffffffff) {
      throw new Error('Unsupported, symlink or oversized ZIP entry')
    }
    if (method === 0 && packedBytes !== rawBytes) throw new Error('Invalid stored ZIP length')
    const name = (await readAt(file, nameBytes, position + 46)).toString('utf8')
    safeName(name)
    const key = name.toLocaleLowerCase('en-US')
    if (usedNames.has(key)) throw new Error('Duplicate ZIP entry (including case collisions)')
    usedNames.add(key)
    totalRaw += rawBytes
    if (totalRaw > MAX_TOTAL || name === MANIFEST && rawBytes > MAX_MANIFEST) {
      throw new Error('ZIP uncompressed size exceeds restore limit')
    }
    entries.push({ name, localOffset, packedBytes, rawBytes, checksum, method, flags })
    position += 46 + nameBytes + extraBytes + commentBytes
    if (position > centralEnd) throw new Error('ZIP central directory overflow')
  }
  if (position !== centralEnd) throw new Error('ZIP central directory mismatch')
  return entries
}

async function unpack(file: fs.FileHandle, entry: Entry): Promise<Buffer> {
  const local = await readAt(file, 30, entry.localOffset)
  if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== entry.flags
    || local.readUInt16LE(8) !== entry.method) throw new Error('ZIP local-header mismatch')
  const nameBytes = local.readUInt16LE(26)
  const extraBytes = local.readUInt16LE(28)
  const name = (await readAt(file, nameBytes, entry.localOffset + 30)).toString('utf8')
  if (name !== entry.name) throw new Error('ZIP local filename mismatch')
  const dataOffset = entry.localOffset + 30 + nameBytes + extraBytes
  const packed = await readAt(file, entry.packedBytes, dataOffset)
  const raw = entry.method === 8
    ? inflateRawSync(packed, { maxOutputLength: Math.max(1, entry.rawBytes) })
    : packed
  if (raw.length !== entry.rawBytes || crc32(raw) !== entry.checksum) {
    throw new Error('ZIP entry CRC or length mismatch')
  }
  return raw
}

function hash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

async function verifyAndRead(file: fs.FileHandle): Promise<{
  info: VerifiedSsrArchive
  entries: Entry[]
  manifest: Record<string, Receipt>
}> {
  const entries = await indexArchive(file)
  const manifestEntry = entries.find(item => item.name === MANIFEST)
  if (!manifestEntry) throw new Error('SSR manifest is missing')
  const parsed: unknown = JSON.parse((await unpack(file, manifestEntry)).toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid SSR manifest')
  const typed = parsed as { schema?: unknown; files?: unknown }
  if (typed.schema !== 'ssr-project-archive-v1' || !typed.files
    || typeof typed.files !== 'object' || Array.isArray(typed.files)) {
    throw new Error('Unsupported SSR backup manifest')
  }
  const receipts = typed.files as Record<string, Receipt>
  if (Object.keys(receipts).length !== entries.length - 1) throw new Error('SSR manifest file count mismatch')
  let projectId = ''
  for (const entry of entries) {
    if (entry.name === MANIFEST) continue
    const spec = Object.hasOwn(receipts, entry.name) ? receipts[entry.name] : null
    if (!spec || spec.bytes !== entry.rawBytes
      || typeof spec.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(spec.sha256)) {
      throw new Error('SSR manifest has a missing or invalid receipt')
    }
    const data = await unpack(file, entry)
    if (hash(data).toLowerCase() !== spec.sha256.toLowerCase()) {
      throw new Error('SSR ZIP SHA-256 verification failed')
    }
    if (entry.name === '.vela/project.json') {
      const project: unknown = JSON.parse(data.toString('utf8'))
      const id = (project as { projectId?: unknown } | null)?.projectId
      if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid restored project ID')
      projectId = id
    }
  }
  if (!projectId || !Object.hasOwn(receipts, '.vela/vela.db')) {
    throw new Error('Missing SSR project metadata or database')
  }
  return {
    info: { fileCount: entries.length - 1, files: entries.filter(e => e.name !== MANIFEST)
      .map(e => ({ name: e.name, bytes: e.rawBytes })), projectId },
    entries, manifest: receipts,
  }
}

export async function verifySsrProjectArchive(archive: string): Promise<VerifiedSsrArchive> {
  const handle = await fs.open(archive, 'r')
  try { return (await verifyAndRead(handle)).info } finally { await handle.close() }
}

function checkSqliteIntegrity(dbPath: string): void {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') {
      throw new Error('Restored SQLite integrity check failed')
    }
  } finally { db.close() }
}

/** The target basename is main-owned; no user ZIP entry can select output paths. */
export async function restoreSsrProjectArchive(
  archive: string,
  destination: string,
  options: { checkDb?: (dbPath: string) => void; forbiddenProjectRoot?: string } = {},
): Promise<{ projectPath: string; files: number; projectId: string }> {
  const parent = await fs.realpath(path.dirname(path.resolve(destination)))
  const target = path.join(parent, path.basename(destination))
  const active = options.forbiddenProjectRoot ? await fs.realpath(options.forbiddenProjectRoot) : null
  if (active && (target.toLowerCase() === active.toLowerCase()
    || target.toLowerCase().startsWith(active.toLowerCase() + path.sep))) {
    throw new Error('Restore destination must be outside the active project')
  }
  safeName(path.basename(target))
  const handle = await fs.open(archive, 'r')
  let reserved = false
  try {
    // Complete ZIP and digest validation before writing any file.
    const verified = await verifyAndRead(handle)
    await fs.mkdir(target) // atomic non-overwrite reservation, even against races
    reserved = true
    for (const entry of verified.entries) {
      if (entry.name === MANIFEST) continue
      const parts = safeName(entry.name)
      const output = path.join(target, ...parts)
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, await unpack(handle, entry), { flag: 'wx' })
    }
    const checkDb = options.checkDb ?? checkSqliteIntegrity
    checkDb(path.join(target, '.vela', 'vela.db'))
    reserved = false
    return { projectPath: target, files: verified.info.fileCount, projectId: verified.info.projectId }
  } finally {
    await handle.close()
    if (reserved) await fs.rm(target, { recursive: true, force: true })
  }
}
