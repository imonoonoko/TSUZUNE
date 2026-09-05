import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const extension = join(root, 'browser-extension')
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'))
assert.equal(manifest.manifest_version, 3)
assert.equal(manifest.version, '0.2.2')
assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage'])
assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1:27193/*'])
assert.equal(manifest.key, 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Y61gcDEqahhrM+20UFadbsA4h7pGj20ATk3t1Rb0l7rqEkIXshkeLKOg52VBtcoCXey+/a0jxuhbus18bu6CKu1P4ZZSFsI7qB/mDV3hAkLZcmIdzFz4eg6ORO7fLNU060qQMXkrnAeC8mbeyyIST6j6MP7HNG9nvWIiCRYiqlFGSaDt3+jPrzC5oJAUdeb/U8ROI1+T2IA/L6rtXsCpbtjIARwETo9suaJ/EuA2ovtGrbaYK/0WMmlQrcLBOETMFGEJs3DjXdRfYk5UIEFjNRPQaepugYtpM5vTmtCGtO5+qSqSLiu4No1l8WlW1BZW067xEX3abS+tXgFFnoHZQIDAQAB')
const digest = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest()
const alphabet = 'abcdefghijklmnop'
let derived = ''
for (const byte of digest.subarray(0, 16)) derived += alphabet[byte >> 4] + alphabet[byte & 15]
assert.equal(derived, 'jlmegmmpabknbfhfcbnakpkmhfoeablh')
const captureSource = await readFile(join(extension, 'capture.js'), 'utf8')
const popupSource = await readFile(join(extension, 'popup.js'), 'utf8')
const readabilitySource = await readFile(join(extension, 'vendor', 'Readability.js'), 'utf8')
const readabilityLicense = await readFile(
  join(extension, 'vendor', 'LICENSE-READABILITY.md'),
  'utf8'
)
const defuddleLicense = await readFile(
  join(extension, 'vendor', 'LICENSE-DEFUDDLE.md'),
  'utf8'
)
const thirdPartyNotices = await readFile(
  join(extension, 'vendor', 'THIRD-PARTY-NOTICES.md'),
  'utf8'
)
assert.match(popupSource, /fetch\(`\$\{endpoint\}\/pair`/)
assert.match(popupSource, /fetch\(`\$\{endpoint\}\/capture`/)
assert.match(popupSource, /vendor\/Readability\.js/)
assert.doesNotMatch(popupSource, /api\/browser-clip/)
assert.match(readabilityLicense, /Apache License, Version 2\.0/)
assert.match(defuddleLicense, /MIT License/)
assert.match(thirdPartyNotices, /Mozilla Readability 0\.6\.0/)
assert.match(thirdPartyNotices, /197db78742ad0fb91100c2b478f5350ee9d8702c/)

async function capture(html, url) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url })
  const context = dom.getInternalVMContext()
  vm.runInContext(readabilitySource, context)
  const result = await vm.runInContext(captureSource, context)
  assert.equal(result, dom.window.result)
  return result
}

const result = await capture(
  '<meta name="description" content="Meta description"><meta name="author" content="Author"><main><h1>Hello</h1><nav>bad nav</nav><script>bad()</script><p>Body text</p></main>',
  'https://example.com/a'
)
assert.deepEqual(Object.keys(result).sort(), ['author', 'content', 'description', 'language', 'requestId', 'selection', 'siteName', 'title', 'url', 'youtube'].sort())
assert.equal(result.title, 'example.com')
assert.equal(result.siteName, 'example.com')
assert.match(result.content, /Hello[\s\S]*Body text/)
assert.doesNotMatch(result.content, /bad/)
assert.equal(result.description, 'Meta description')
assert.equal(result.author, 'Author')
const readable = await capture(
  `<title>Readable article</title><nav>Navigation noise</nav><article><h1>Readable article</h1><p>${'This is a substantial article sentence with useful context. '.repeat(40)}</p></article><aside>Sidebar noise</aside>`,
  'https://example.com/readable'
)
assert.match(readable.content, /substantial article sentence/)
assert.doesNotMatch(readable.content, /Navigation noise|Sidebar noise/)
const youtube = await capture(
  '<title>Video</title><div id="description">Desc</div><ytd-channel-name>Channel</ytd-channel-name><div class="ytp-time-current">1:05</div><ytd-transcript-segment-renderer>Visible line</ytd-transcript-segment-renderer>',
  'https://www.youtube.com/watch?v=abc123'
)
assert.equal(youtube.youtube.videoId, 'abc123')
assert.equal(youtube.youtube.transcriptStatus, 'captured')
assert.match(youtube.youtube.transcript, /Visible line/)
assert.ok(Buffer.byteLength(JSON.stringify(youtube), 'utf8') < 131072)
const shorts = await capture(
  '<title>Short</title><main>Short body</main>',
  'https://m.youtube.com/shorts/shorts123'
)
assert.equal(shorts.youtube.videoId, 'shorts123')
const lookalike = await capture(
  '<title>Not YouTube</title><main>Keep this body</main>',
  'https://evilyoutube.com/watch?v=abc123'
)
assert.equal(lookalike.youtube, undefined)
assert.match(lookalike.content, /Keep this body/)
for (const file of ['capture.js', 'popup.js', 'vendor/Readability.js']) {
  new vm.Script(await readFile(join(extension, file), 'utf8'), { filename: file })
}
console.log('browser clipper self-check: PASS')
