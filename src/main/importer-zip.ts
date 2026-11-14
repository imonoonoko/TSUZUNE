import { crc32, inflateRawSync } from 'node:zlib'
import { IMPORT_MAX_FILES, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_TOTAL_BYTES, safeImportPath, hasImportCaseCollision, type ImportFile } from '../shared/importer'

const bad = (): never => { throw new Error('ZIPが壊れているか、未対応・危険な形式です。ZIP64・暗号化・分割ZIPは取り込めません。') }
export const importCrc32 = crc32

/** Ordinary single-volume store/deflate ZIP; bounds are checked before allocation/inflation. */
export function readImportZip(input: Uint8Array): ImportFile[] {
  const zip = Buffer.from(input.buffer, input.byteOffset, input.byteLength)
  if (zip.length > IMPORT_MAX_FILE_BYTES || zip.length < 22) bad()
  let end = -1
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset--) {
    if (zip.readUInt32LE(offset) === 0x06054b50 && offset + 22 + zip.readUInt16LE(offset + 20) === zip.length) { end = offset; break }
  }
  if (end < 0 || zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6)) bad()
  const count = zip.readUInt16LE(end + 10), centralSize = zip.readUInt32LE(end + 12), centralStart = zip.readUInt32LE(end + 16)
  if (count !== zip.readUInt16LE(end + 8) || !count || count > IMPORT_MAX_FILES || count === 0xffff ||
    centralSize === 0xffffffff || centralStart === 0xffffffff || centralStart + centralSize !== end) bad()
  const names = new Set<string>(), paths: string[] = [], files: ImportFile[] = [], ranges: Array<[number, number]> = []
  let cursor = centralStart, total = 0
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) bad()
    const flags = zip.readUInt16LE(cursor + 8), method = zip.readUInt16LE(cursor + 10), crc = zip.readUInt32LE(cursor + 16)
    const packed = zip.readUInt32LE(cursor + 20), size = zip.readUInt32LE(cursor + 24)
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32)
    const local = zip.readUInt32LE(cursor + 42), attrs = zip.readUInt32LE(cursor + 38), nameStart = cursor + 46
    if (nameStart + nameLength + extraLength + commentLength > end || !nameLength || zip.readUInt16LE(cursor + 34) ||
      (flags & ~(method === 8 ? 0x080e : 0x0808)) || ![0, 8].includes(method) || size > IMPORT_MAX_FILE_BYTES || packed === 0xffffffff || local === 0xffffffff ||
      ((attrs >>> 16) & 0xf000) === 0xa000) bad()
    // Reject ZIP64 and Unicode-path overrides rather than interpreting conflicting names.
    for (let e = nameStart + nameLength; e < nameStart + nameLength + extraLength;) {
      if (e + 4 > nameStart + nameLength + extraLength) bad()
      const id = zip.readUInt16LE(e), length = zip.readUInt16LE(e + 2)
      if (id === 1 || id === 0x7075 || e + 4 + length > nameStart + nameLength + extraLength) bad()
      e += 4 + length
    }
    const rawName = zip.subarray(nameStart, nameStart + nameLength)
    if (!(flags & 0x800) && rawName.some(byte => byte > 127)) bad()
    let name: string
    try { name = new TextDecoder('utf-8', { fatal: true }).decode(rawName) } catch { bad() }
    const directory = name!.endsWith('/'), path = directory ? name!.slice(0, -1) : name!
    if (!safeImportPath(path) || names.has(path.toLowerCase())) bad()
    names.add(path.toLowerCase())
    paths.push(path)
    if (local + 30 > centralStart || zip.readUInt32LE(local) !== 0x04034b50 || zip.readUInt16LE(local + 6) !== flags || zip.readUInt16LE(local + 8) !== method) bad()
    const localNameSize = zip.readUInt16LE(local + 26), localExtraSize = zip.readUInt16LE(local + 28), dataStart = local + 30 + localNameSize + localExtraSize
    if (dataStart + packed > centralStart || !zip.subarray(local + 30, local + 30 + localNameSize).equals(rawName) ||
      ranges.some(([a, b]) => local < b && dataStart + packed > a)) bad()
    ranges.push([local, dataStart + packed])
    if (!(flags & 8) && (zip.readUInt32LE(local + 14) !== crc || zip.readUInt32LE(local + 18) !== packed || zip.readUInt32LE(local + 22) !== size)) bad()
    total += size
    if (total > IMPORT_MAX_TOTAL_BYTES || (directory && (size || packed))) bad()
    let bytes: Buffer
    try { bytes = method === 0 ? Buffer.from(zip.subarray(dataStart, dataStart + packed)) : inflateRawSync(zip.subarray(dataStart, dataStart + packed), { maxOutputLength: Math.max(1, size) }) } catch { bad() }
    if (bytes!.length !== size || importCrc32(bytes!) !== crc) bad()
    if (!directory) files.push({ path, bytes: new Uint8Array(bytes!) })
    cursor = nameStart + nameLength + extraLength + commentLength
  }
  if (cursor !== centralStart + centralSize) bad()
  if (hasImportCaseCollision(paths)) bad()
  const fileNames = files.map(file => file.path.toLowerCase())
  if (fileNames.some(name => [...names].some(other => other !== name && other.startsWith(name + '/')))) bad()
  return files
}
