import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { archiveProject } from '../ssr-project-archive'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true })
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ssr-gui-backup-'))
  roots.push(root)
  const project = path.join(root, 'novel')
  await fs.mkdir(path.join(project, '.vela'), { recursive: true })
  await fs.writeFile(path.join(project, '.vela', 'project.json'), '{"projectId":"synthetic"}')
  await fs.writeFile(path.join(project, 'Chapter 1.txt'), 'Đoạn văn thử nghiệm không liên quan đến truyện.', 'utf8')
  const dbFile = path.join(project, '.vela', 'vela.db')
  await fs.writeFile(dbFile, Buffer.alloc(4096, 17))
  const db = { backup: async (destination: string) => fs.copyFile(dbFile, destination), close: () => undefined }
  return { root, project, db }
}

function unzipLocalEntries(bytes: Buffer): Record<string, Buffer> {
  const entries: Record<string, Buffer> = {}
  let offset = 0
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const packedBytes = bytes.readUInt32LE(offset + 18)
    const nameBytes = bytes.readUInt16LE(offset + 26)
    const extraBytes = bytes.readUInt16LE(offset + 28)
    const name = bytes.subarray(offset + 30, offset + 30 + nameBytes).toString('utf8')
    const begin = offset + 30 + nameBytes + extraBytes
    entries[name] = inflateRawSync(bytes.subarray(begin, begin + packedBytes))
    offset = begin + packedBytes
  }
  expect(bytes.readUInt32LE(offset)).toBe(0x02014b50)
  return entries
}

describe('SSR GUI project archive writer', () => {
  it('creates a readable ZIP with manifest + an online SQLite snapshot', async () => {
    const { root, project, db } = await fixture()
    try {
      const target = path.join(root, 'archive.zip')
      const receipt = await archiveProject(project, target, db)
      expect(receipt.files).toBe(3)
      const entries = unzipLocalEntries(await fs.readFile(target))
      const manifest = JSON.parse(entries['ssr-backup-manifest.json'].toString('utf8'))
      expect(manifest.schema).toBe('ssr-project-archive-v1')
      expect(manifest.files).toHaveProperty('.vela/vela.db')
      expect(entries['Chapter 1.txt'].toString('utf8')).toBe('Đoạn văn thử nghiệm không liên quan đến truyện.')
      expect(entries['.vela/vela.db'].length).toBeGreaterThan(100)
      expect(entries).not.toHaveProperty('.vela/vela.db-shm')
    } finally {
      db.close()
    }
  })

  it('never overwrites an existing ZIP or writes inside the project', async () => {
    const { root, project, db } = await fixture()
    try {
      const target = path.join(root, 'existing.zip')
      await fs.writeFile(target, 'author-original')
      await expect(archiveProject(project, target, db)).rejects.toThrow('already exists')
      expect(await fs.readFile(target, 'utf8')).toBe('author-original')
      await expect(archiveProject(project, path.join(project, 'bad.zip'), db))
        .rejects.toThrow('outside')
    } finally {
      db.close()
    }
  })
})
