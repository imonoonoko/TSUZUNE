const endpoint = 'http://127.0.0.1:27193'
const $ = (id) => document.getElementById(id)
const status = (s) => { $('status').textContent = s }
async function capture() {
  const clip = $('clip')
  if (clip.disabled) return
  clip.disabled = true
  let reenable = true
  status('保存中…')
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !/^https?:/.test(tab.url)) return status('このページは対応していません（Chrome内部ページ・file URLは不可）。')
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['vendor/Readability.js', 'capture.js']
    })
    const { token } = await chrome.storage.local.get('token')
    if (!token) return status('先に6桁のペアリングコードを入力してください。')
    const response = await fetch(`${endpoint}/capture`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify(result) })
    if (response.status === 401) {
      await chrome.storage.local.remove('token')
      $('pair').hidden = false
      reenable = false
      return status('ペアリングが必要です。6桁のコードを入力してください。')
    }
    if (response.status === 400) return status('ページ情報が不正です。')
    if (response.status === 403) return status('この操作は許可されていません。')
    if (response.status === 413) return status('ページが大きすぎます。選択範囲を小さくして再試行してください。')
    if (!response.ok) return status('TSUZUNEが起動していません。')
    const saved = await response.json()
    const transcriptStatus = saved.youtubeTranscriptStatus || result.youtube?.transcriptStatus
    if (transcriptStatus === 'captured') return status('受信箱に保存しました（字幕あり）')
    if (transcriptStatus === 'truncated') return status('受信箱に保存しました（字幕は一部）')
    if (transcriptStatus === 'unavailable') return status('受信箱に保存しました（字幕を確認できず）')
    if (transcriptStatus === 'failed') return status('受信箱に保存しました（表示中の情報のみ）')
    status(`受信箱に保存しました：${saved.path || '01_受信箱'}`)
  } catch { status('TSUZUNEが起動していないか、このページを読み取れません。秘密情報を含むページは保存しないでください。') }
  finally { clip.disabled = !reenable }
}
async function pair() {
  const code = $('code').value.trim()
  if (!/^\d{6}$/.test(code)) return status('6桁のコードを入力してください。')
  $('pairButton').disabled = true
  status('ペアリング中…')
  try {
    const r = await fetch(`${endpoint}/pair`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code }) })
    if (!r.ok) return status('ペアリングに失敗しました。')
    const { token } = await r.json()
    await chrome.storage.local.set({ token })
    $('pair').hidden = true
    $('clip').disabled = false
    status('ペアリングしました。このページを保存できます。')
  } catch { status('TSUZUNEが起動していません。') }
  finally { $('pairButton').disabled = false }
}
$('pairButton').onclick = pair
$('clip').onclick = capture
chrome.storage.local.get('token').then(({ token }) => {
  $('pair').hidden = Boolean(token)
  $('clip').disabled = !token
  status(token ? '準備完了。このページを保存できます。' : '6桁のコードでペアリングしてください。')
})
