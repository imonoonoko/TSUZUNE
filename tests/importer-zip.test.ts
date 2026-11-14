import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { importCrc32, readImportZip } from '../src/main/importer-zip'
import { IMPORT_MAX_FILE_BYTES } from '../src/shared/importer'

function zip(entries: Array<{ name: string; text: string; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name), bytes = Buffer.from(entry.text), data = entry.deflate ? deflateRawSync(bytes) : bytes
    const local = Buffer.alloc(30), central = Buffer.alloc(46)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(entry.deflate ? 8 : 0, 8)
    local.writeUInt32LE(importCrc32(bytes), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26)
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); local.copy(central, 8, 6, 10)
    local.copy(central, 16, 14, 26); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42)
    locals.push(local, name, data); centrals.push(central, name); offset += local.length + name.length + data.length
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}
describe('bounded ZIP source', () => {
  it('decodes stored and deflated UTF8 entries without extracting to disk', () => {
    const files = readImportZip(zip([{ name: '日本語/A.md', text: '# source' }, { name: 'asset.txt', text: 'repeated '.repeat(50), deflate: true }]))
    expect(files.map(file => file.path)).toEqual(['日本語/A.md', 'asset.txt'])
    expect(new TextDecoder().decode(files[1].bytes)).toBe('repeated '.repeat(50))
  })
  it('accepts ordinary deflate compression-option flags', () => {
    const archive = zip([{ name: 'A.md', text: '# note', deflate: true }]), central = archive.readUInt32LE(archive.length - 6)
    archive.writeUInt16LE(0x802, 6); archive.writeUInt16LE(0x802, central + 8)
    expect(readImportZip(archive)[0].path).toBe('A.md')
  })
  it.each(['../escape.md', '/root.md', 'C:/root.md', 'a\\escape.md', 'CON.md', 'tail .', '.hidden/A.md'])('rejects unsafe name %s', name => {
    expect(() => readImportZip(zip([{ name, text: 'x' }]))).toThrow('ZIP')
  })
  it('rejects CRC damage, duplicate/case-colliding entries and file-directory collisions', () => {
    const corrupt = zip([{ name: 'A.md', text: 'content' }]); corrupt[34] ^= 1
    expect(() => readImportZip(corrupt)).toThrow()
    for (const names of [['A.md', 'a.MD'], ['a', 'a/b.md'], ['Dir/A.md', 'dir/B.md']]) expect(() => readImportZip(zip(names.map(name => ({ name, text: 'x' }))))).toThrow()
  })
  it('rejects ZIP64, encryption, multiple volumes, symlinks, invalid sizes and truncation', () => {
    const source = zip([{ name: 'A.md', text: 'data', deflate: true }]), central = source.readUInt32LE(source.length - 6)
    for (const mutate of [
      (b: Buffer) => b.writeUInt16LE(1, b.length - 18),
      (b: Buffer) => b.writeUInt32LE(0xffffffff, b.length - 6),
      (b: Buffer) => b.writeUInt16LE(1, central + 8),
      (b: Buffer) => b.writeUInt32LE(0xa0000000, central + 38),
      (b: Buffer) => b.writeUInt32LE(IMPORT_MAX_FILE_BYTES + 1, central + 24),
      (b: Buffer) => b.writeUInt32LE(2, central + 24)
    ]) { const modified = Buffer.from(source); mutate(modified); expect(() => readImportZip(modified)).toThrow() }
    expect(() => readImportZip(source.subarray(0, source.length - 1))).toThrow()
  })
})
