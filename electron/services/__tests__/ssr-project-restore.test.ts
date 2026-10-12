import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { archiveProject } from '../ssr-project-archive'
import { verifySsrProjectArchive, restoreSsrProjectArchive } from '../ssr-project-restore'

const cleanup: string[] = []
afterEach(async () => {
  for (const dir of cleanup.splice(0)) await fs.rm(dir, { recursive: true, force: true })
})

async function makeArchive() {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'ssr-restore-test-'))
  cleanup.push(sandbox)
  const novel = path.join(sandbox, 'source')
  const archive = path.join(sandbox, 'sample.ssr.zip')
  await fs.mkdir(path.join(novel, '.vela'), { recursive: true })
  await fs.writeFile(path.join(novel, '.vela', 'project.json'), '{"projectId":"fixture-restore"}')
  await fs.writeFile(path.join(novel, 'Chapter 1.txt'), 'A synthetic finalized paragraph.')
  const dbfile = path.join(novel, '.vela', 'vela.db')
  await fs.writeFile(dbfile, Buffer.alloc(8192, 55))
  await archiveProject(novel, archive, { backup: (destination) => fs.copyFile(dbfile, destination) })
  return { sandbox, archive, novel }
}

describe('SSR main-process safe ZIP restoration', () => {
  it('round trips a GUI ZIP with project manifest, CRC and SHA-256 receipts', async () => {
    const { sandbox, archive } = await makeArchive()
    const info = await verifySsrProjectArchive(archive)
    expect(info.fileCount).toBe(3)
    expect(info.projectId).toBe('fixture-restore')
    const dest = path.join(sandbox, 'restored')
    const result = await restoreSsrProjectArchive(archive, dest, {
      checkDb: (file) => expect(path.basename(file)).toBe('vela.db'),
    })
    expect(result.projectPath).toBe(dest)
    expect(await fs.readFile(path.join(dest, 'Chapter 1.txt'), 'utf8'))
      .toBe('A synthetic finalized paragraph.')
    expect(await fs.readFile(path.join(dest, '.vela', 'project.json'), 'utf8'))
      .toContain('fixture-restore')
    await expect(restoreSsrProjectArchive(archive, dest, { checkDb: () => {} }))
      .rejects.toThrow(/exist/i)
  })

  it('rejects tampered archives without creating any project directory', async () => {
    const { sandbox, archive } = await makeArchive()
    const data = await fs.readFile(archive)
    const payload = Buffer.from('A synthetic finalized paragraph.')
    const tampered = Buffer.from(data)
    // Flip a byte of compressed payload without repairing CRC or SHA-256.
    const start = tampered.indexOf(Buffer.from('Chapter 1.txt'))
    expect(start).toBeGreaterThan(0)
    const compressed = start + 'Chapter 1.txt'.length
    tampered[compressed + 4] ^= 0x10
    const corrupt = path.join(sandbox, 'tampered.zip')
    await fs.writeFile(corrupt, tampered)
    const dest = path.join(sandbox, 'untrusted')
    await expect(restoreSsrProjectArchive(corrupt, dest, { checkDb: () => {} }))
      .rejects.toThrow()
    await expect(fs.access(dest)).rejects.toThrow()
    expect(payload.length).toBeGreaterThan(5)
  })

  it('blocks ZIP-slip paths before making folders', async () => {
    const { sandbox, archive } = await makeArchive()
    const bytes = await fs.readFile(archive)
    const evil = Buffer.from('../escape.txt')
    const good = Buffer.from('Chapter 1.txt')
    expect(evil.length).toBe(good.length)
    let count = 0
    let position = 0
    while ((position = bytes.indexOf(good, position)) >= 0) {
      evil.copy(bytes, position)
      count += 1
      position += good.length
    }
    expect(count).toBeGreaterThanOrEqual(2)
    const malicious = path.join(sandbox, 'zip-slip.zip')
    await fs.writeFile(malicious, bytes)
    const dest = path.join(sandbox, 'restored')
    await expect(restoreSsrProjectArchive(malicious, dest, { checkDb: () => {} }))
      .rejects.toThrow(/Unsafe ZIP/)
    await expect(fs.access(dest)).rejects.toThrow()
    await expect(fs.access(path.join(sandbox, 'escape.txt'))).rejects.toThrow()
  })

  it('rejects active project destinations and cleans up SQLite validation failures', async () => {
    const { sandbox, archive, novel } = await makeArchive()
    const inside = path.join(novel, 'restored-unsafe')
    await expect(restoreSsrProjectArchive(archive, inside, {
      forbiddenProjectRoot: novel, checkDb: () => {},
    })).rejects.toThrow(/outside the active project/)
    const dest = path.join(sandbox, 'bad-database')
    await expect(restoreSsrProjectArchive(archive, dest, {
      checkDb: () => { throw new Error('SQLite integrity check failed') },
    })).rejects.toThrow(/SQLite integrity/)
    await expect(fs.access(dest)).rejects.toThrow()
  })
})
