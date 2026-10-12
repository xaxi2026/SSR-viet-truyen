/**
 * SSR project archive (initial GUI backup writer).
 * A self-contained ZIP/DEFLATE implementation avoids a runtime Python dependency.
 * SQLite is snapshotted by the app's live better-sqlite3 connection.
 * Only called by the main process after a valid project session has been checked.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const MAX_FILE = 256 * 1024 * 1024
const MAX_TOTAL = 2 * 1024 * 1024 * 1024
const MAX_ENTRIES = 20_000
const OMIT = new Set(['vela.db-wal', 'vela.db-shm', 'vela.db-journal'])

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1)
  return crc >>> 0
})

export function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF
  for (const byte of data) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

interface Item { name: string; source: string }
interface CentralEntry { header: Buffer; name: Buffer }

async function collect(projectRoot: string): Promise<Item[]> {
  const result: Item[] = []
  async function descend(root: string, prefix: string) {
    for (const file of await fs.readdir(root, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${file.name}` : file.name
      const source = path.join(root, file.name)
      const type = await fs.lstat(source)
      if (type.isSymbolicLink()) throw new Error(`Symlink/junction is not backed up: ${relative}`)
      if (type.isDirectory()) { await descend(source, relative); continue }
      if (!type.isFile()) throw new Error(`Unsupported file type in project: ${relative}`)
      if (OMIT.has(file.name.toLowerCase()) || relative === '.vela/vela.db') continue
      if (type.size > MAX_FILE) throw new Error(`File too large for initial archive writer: ${relative}`)
      result.push({ name: relative, source })
      if (result.length > MAX_ENTRIES) throw new Error('Too many project files')
    }
  }
  await descend(projectRoot, '')
  return result.sort((a, b) => a.name.localeCompare(b.name))
}

async function createZip(items: Item[], output: string): Promise<{ fileCount: number; bytes: number }> {
  const writer = await fs.open(output, 'wx')
  let position = 0
  let rawTotal = 0
  const central: CentralEntry[] = []
  const manifest: Record<string, { bytes: number; sha256: string }> = {}

  async function write(data: Buffer) {
    let written = 0
    while (written < data.length) {
      const result = await writer.write(data, written, data.length - written, position + written)
      if (result.bytesWritten <= 0) throw new Error('Incomplete ZIP write')
      written += result.bytesWritten
    }
    position += data.length
  }

  async function add(name: string, data: Buffer, inManifest: boolean) {
    rawTotal += data.length
    if (rawTotal > MAX_TOTAL || position > 0xFFFFFFFF) throw new Error('Archive exceeds ZIP32 limits')
    if (inManifest) manifest[name] = { bytes: data.length, sha256: sha256(data) }
    const encoded = Buffer.from(name, 'utf8')
    if (encoded.length > 65535) throw new Error('Archive name too long')
    const compressed = deflateRawSync(data, { level: 6 })
    const checksum = crc32(data)
    const offset = position
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(8, 8) // raw DEFLATE
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(encoded.length, 26)
    await write(local)
    await write(encoded)
    await write(compressed)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(8, 10)
    header.writeUInt32LE(checksum, 16)
    header.writeUInt32LE(compressed.length, 20)
    header.writeUInt32LE(data.length, 24)
    header.writeUInt16LE(encoded.length, 28)
    header.writeUInt32LE(offset, 42)
    central.push({ header, name: encoded })
  }

  try {
    for (const item of items) {
      const data = await fs.readFile(item.source)
      if (data.length > MAX_FILE) throw new Error(`File grew while archiving: ${item.name}`)
      await add(item.name, data, true)
    }
    await add('ssr-backup-manifest.json',
      Buffer.from(JSON.stringify({ schema: 'ssr-project-archive-v1', snapshot: 'sqlite-online-backup', files: manifest }, null, 2), 'utf8'),
      false)
    const centralStart = position
    for (const item of central) {
      await write(item.header)
      await write(item.name)
    }
    const centralBytes = position - centralStart
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(central.length, 8)
    end.writeUInt16LE(central.length, 10)
    end.writeUInt32LE(centralBytes, 12)
    end.writeUInt32LE(centralStart, 16)
    await write(end)
    await writer.sync()
    return { fileCount: items.length, bytes: position }
  } finally {
    await writer.close()
  }
}

/** Read back the new ZIP and compare decompressed bytes with its SHA-256 manifest. */
async function verifyGeneratedArchive(archive: string): Promise<void> {
  const file = await fs.open(archive, 'r')
  const receipt: Record<string, { bytes: number; sha256: string }> = {}
  let recordedManifest: { schema: string; files: Record<string, { bytes: number; sha256: string }> } | null = null
  let offset = 0

  async function readExactly(bytes: number, position: number): Promise<Buffer> {
    const buffer = Buffer.alloc(bytes)
    let received = 0
    while (received < bytes) {
      const result = await file.read(buffer, received, bytes - received, position + received)
      if (result.bytesRead <= 0) throw new Error('Incomplete ZIP archive')
      received += result.bytesRead
    }
    return buffer
  }

  try {
    let entries = 0
    while (offset < MAX_TOTAL + 1_000_000) {
      const header = await readExactly(30, offset)
      if (header.readUInt32LE(0) === 0x02014b50) break
      if (header.readUInt32LE(0) !== 0x04034b50 || header.readUInt16LE(8) !== 8) {
        throw new Error('Unsupported ZIP entry in generated archive')
      }
      const compressedBytes = header.readUInt32LE(18)
      const rawBytes = header.readUInt32LE(22)
      const nameBytes = header.readUInt16LE(26)
      const extraBytes = header.readUInt16LE(28)
      if (compressedBytes > MAX_FILE + 1024 || rawBytes > MAX_FILE || ++entries > MAX_ENTRIES + 1) {
        throw new Error('ZIP entry exceeds verified limits')
      }
      const name = (await readExactly(nameBytes, offset + 30)).toString('utf8')
      if (name in receipt || (name === 'ssr-backup-manifest.json' && recordedManifest)) {
        throw new Error('Duplicate ZIP entry')
      }
      const payloadStart = offset + 30 + nameBytes + extraBytes
      const raw = inflateRawSync(await readExactly(compressedBytes, payloadStart))
      if (raw.length !== rawBytes || crc32(raw) !== header.readUInt32LE(14)) {
        throw new Error('Generated archive has a CRC/length mismatch')
      }
      if (name === 'ssr-backup-manifest.json') {
        recordedManifest = JSON.parse(raw.toString('utf8')) as typeof recordedManifest
      } else {
        receipt[name] = { bytes: raw.length, sha256: sha256(raw) }
      }
      offset = payloadStart + compressedBytes
    }
    const completeManifest = recordedManifest as { schema: string; files: Record<string, { bytes: number; sha256: string }> } | null
    if (completeManifest?.schema !== 'ssr-project-archive-v1'
        || JSON.stringify(completeManifest.files) !== JSON.stringify(receipt)) {
      throw new Error('Generated ZIP SHA-256 receipts do not match')
    }
  } finally {
    await file.close()
  }
}

export interface BackupProjectDb { backup(destination: string): Promise<unknown> }

export async function archiveProject(
  projectRoot: string,
  targetZip: string,
  database: BackupProjectDb,
): Promise<{ path: string; files: number; bytes: number }> {
  const root = await fs.realpath(projectRoot)
  const destination = path.resolve(targetZip)
  if (destination.toLowerCase().startsWith(root.toLowerCase() + path.sep)) {
    throw new Error('Archive must be stored outside the source project')
  }
  if (!(await fs.stat(path.join(root, '.vela', 'project.json'))).isFile()) {
    throw new Error('SSR project manifest not found')
  }
  // Do not overwrite user files, even when the save dialog was shown.
  try {
    await fs.lstat(destination)
    throw new Error('Target archive already exists')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ssr-sqlite-snapshot-'))
  const incomplete = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomUUID()}.incomplete`)
  try {
    const snapshot = path.join(scratch, 'vela.db')
    await database.backup(snapshot)
    const items = await collect(root)
    if (items.some(item => item.name === 'ssr-backup-manifest.json')) {
      throw new Error('Reserved manifest filename exists')
    }
    items.push({ name: '.vela/vela.db', source: snapshot })
    items.sort((a, b) => a.name.localeCompare(b.name))
    const result = await createZip(items, incomplete)
    await verifyGeneratedArchive(incomplete)
    // Do not replace anything created after the save dialog selection.
    await fs.link(incomplete, destination)
    await fs.unlink(incomplete)
    return { path: destination, files: result.fileCount, bytes: result.bytes }
  } finally {
    await fs.rm(incomplete, { force: true }).catch(() => undefined)
    await fs.rm(scratch, { recursive: true, force: true })
  }
}
