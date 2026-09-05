(async () => {
  const text = (node) => (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim()
  const prose = (value) => String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const bounded = (value, size) => String(value || '').slice(0, size)
  const emptyTranscript = () => ({ transcript: '', truncated: false })
  const boundedTranscript = (candidates) => {
    const lines = []
    const seen = new Set()
    for (const candidate of candidates) {
      const line = String(candidate || '').trim()
      if (!line || seen.has(line)) continue
      seen.add(line)
      lines.push(line)
    }
    return { transcript: lines.join('\n'), truncated: false }
  }
  const meta = (...selectors) => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content')?.trim()
      if (value) return value
    }
    return ''
  }
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  const url = location.href
  const selected = typeof getSelection === 'function' ? String(getSelection()).trim() : ''
  const sourceLocation = document.createElement('a')
  sourceLocation.href = url
  const host = sourceLocation.hostname.toLowerCase()
  const pathParts = sourceLocation.pathname.split('/').filter(Boolean)
  const queryVideoId = /(?:^|[?&])v=([\w-]{6,64})(?:&|$)/.exec(sourceLocation.search)?.[1]
  const youtubeId =
    host === 'youtu.be'
      ? pathParts[0]
      : host === 'youtube.com' || host.endsWith('.youtube.com')
        ? queryVideoId || (['shorts', 'embed', 'live'].includes(pathParts[0]) ? pathParts[1] : undefined)
        : undefined

  const fallbackArticle = () => {
    const clean = document.cloneNode(true)
    clean.querySelectorAll('script,style,nav,header,footer,aside,form,noscript').forEach((node) => node.remove())
    return {
      title: document.title?.trim() || sourceLocation.hostname || 'Webクリップ',
      description: meta('meta[name="description"]', 'meta[property="og:description"]'),
      content: text(clean.querySelector('article,main') || clean.body),
      siteName: meta('meta[property="og:site_name"]') || sourceLocation.hostname,
      author: meta('meta[name="author"]', 'meta[property="article:author"]'),
      language: document.documentElement.lang || ''
    }
  }

  const readableArticle = () => {
    if (typeof globalThis.Readability !== 'function') return null
    try {
      const article = new globalThis.Readability(document.cloneNode(true)).parse()
      const content = prose(article?.textContent)
      if (content.length < 200) return null
      return {
        title: article.title || document.title?.trim() || sourceLocation.hostname || 'Webクリップ',
        description: article.excerpt || meta('meta[name="description"]', 'meta[property="og:description"]'),
        content,
        siteName: article.siteName || meta('meta[property="og:site_name"]') || sourceLocation.hostname,
        author: article.byline || meta('meta[name="author"]', 'meta[property="article:author"]'),
        language: article.lang || document.documentElement.lang || ''
      }
    } catch {
      return null
    }
  }

  const transcriptFromPage = () => {
    return boundedTranscript(
      Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'), text)
    )
  }

  const transcriptButton = () => Array.from(document.querySelectorAll('button,[role="button"]')).find((node) => {
    const label = `${node.getAttribute('aria-label') || ''} ${text(node)}`
    const style = getComputedStyle(node)
    const hidden = node.hidden ||
      node.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' ||
      style.visibility === 'hidden'
    return !hidden &&
      /文字起こしを表示|文字起こし|show transcript|transcript/i.test(label) &&
      !/文字起こしを閉じる|close transcript|hide transcript/i.test(label)
  })

  const openTranscriptPanel = async () => {
    const button = transcriptButton()
    if (!button) return { attempted: false, ...emptyTranscript() }
    button.click()
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = transcriptFromPage()
      if (result.transcript) return { attempted: true, ...result }
      await delay(150)
    }
    return { attempted: true, ...emptyTranscript() }
  }

  const jsonObjectAfter = (source, marker) => {
    let markerIndex = source.indexOf(marker)
    while (markerIndex !== -1) {
      const start = source.indexOf('{', markerIndex + marker.length)
      if (start === -1) return null
      let depth = 0
      let quoted = false
      let escaped = false
      for (let index = start; index < source.length; index += 1) {
        const character = source[index]
        if (quoted) {
          if (escaped) escaped = false
          else if (character === '\\') escaped = true
          else if (character === '"') quoted = false
          continue
        }
        if (character === '"') quoted = true
        else if (character === '{') depth += 1
        else if (character === '}') {
          depth -= 1
          if (depth === 0) {
            try {
              return JSON.parse(source.slice(start, index + 1))
            } catch {
              break
            }
          }
        }
      }
      markerIndex = source.indexOf(marker, markerIndex + marker.length)
    }
    return null
  }

  const selectCaptionTrack = (tracks) => {
    const requested = (document.documentElement.lang || '').toLowerCase()
    const requestedBase = requested.split('-')[0]
    return tracks
      .map((track, index) => {
        const language = String(track?.languageCode || '').toLowerCase()
        let score = -index
        if (requested && language === requested) score += 100
        else if (requestedBase && language.split('-')[0] === requestedBase) score += 80
        else if (language === 'en' || language.startsWith('en-')) score += 20
        if (track?.kind !== 'asr') score += 10
        return { track, score }
      })
      .sort((left, right) => right.score - left.score)[0]?.track
  }

  const captionTrackState = () => {
    let stale = false
    let currentSeen = false
    for (const script of document.scripts) {
      const source = script.textContent || ''
      if (!source.includes('ytInitialPlayerResponse')) continue
      const response = jsonObjectAfter(source, 'ytInitialPlayerResponse')
      if (!response) continue
      const responseVideoId = response?.videoDetails?.videoId ??
        response?.microformat?.playerMicroformatRenderer?.externalVideoId
      if (responseVideoId !== youtubeId) {
        stale = true
        continue
      }
      currentSeen = true
      const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (Array.isArray(tracks) && tracks.length) {
        return { kind: 'available', track: selectCaptionTrack(tracks) }
      }
    }
    return { kind: !currentSeen && stale ? 'stale' : 'none', track: null }
  }

  const timestamp = (seconds) => {
    const whole = Math.max(0, Math.floor(Number(seconds) || 0))
    const hours = Math.floor(whole / 3600)
    const minutes = Math.floor((whole % 3600) / 60)
    const remaining = whole % 60
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
      : `${minutes}:${String(remaining).padStart(2, '0')}`
  }

  const transcriptFromXml = (source) => {
    if (!source.trim()) return emptyTranscript()
    const xml = new DOMParser().parseFromString(source, 'text/xml')
    if (xml.querySelector('parsererror')) return emptyTranscript()
    return boundedTranscript(
      Array.from(xml.querySelectorAll('p,text'))
        .map((node) => {
          const parts = Array.from(node.querySelectorAll('s'))
          const content = prose(parts.length ? parts.map((part) => part.textContent || '').join('') : node.textContent)
          if (!content) return ''
          const rawTimestamp = node.tagName.toLowerCase() === 'p'
            ? node.getAttribute('t')
            : node.getAttribute('start')
          if (rawTimestamp === null || !rawTimestamp.trim()) return ''
          const numericTimestamp = Number(rawTimestamp)
          if (!Number.isFinite(numericTimestamp) || numericTimestamp < 0) return ''
          const seconds = node.tagName.toLowerCase() === 'p'
            ? numericTimestamp / 1000
            : numericTimestamp
          return `${timestamp(seconds)} ${content}`
        })
        .filter(Boolean)
    )
  }

  const readBoundedResponse = async (response) => {
    const maxBytes = 512 * 1024
    const declaredLength = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return ''
    if (response.body?.getReader && typeof TextDecoder === 'function') {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let total = 0
      let value = ''
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        total += chunk.value.byteLength
        if (total > maxBytes) {
          await reader.cancel()
          return ''
        }
        value += decoder.decode(chunk.value, { stream: true })
      }
      return value + decoder.decode()
    }
    const value = await response.text()
    return value.length <= maxBytes ? value : ''
  }

  const fetchCaptionTrack = async (track) => {
    if (!track?.baseUrl || typeof fetch !== 'function') return emptyTranscript()
    let captionUrl
    try {
      captionUrl = new URL(track.baseUrl, url)
    } catch {
      return emptyTranscript()
    }
    const captionHost = captionUrl.hostname.toLowerCase()
    if (
      captionUrl.protocol !== 'https:' ||
      !(captionHost === 'youtube.com' || captionHost.endsWith('.youtube.com')) ||
      captionUrl.pathname !== '/api/timedtext' ||
      captionUrl.searchParams.get('v') !== youtubeId
    ) {
      return emptyTranscript()
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await fetch(captionUrl.toString(), {
        credentials: 'include',
        signal: controller.signal
      })
      if (!response.ok) return emptyTranscript()
      return transcriptFromXml(await readBoundedResponse(response))
    } catch {
      return emptyTranscript()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const article = youtubeId ? fallbackArticle() : (readableArticle() || fallbackArticle())
  const randomId = () => globalThis.crypto?.randomUUID?.() || `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  const result = {
    requestId: randomId(),
    url,
    title: bounded(youtubeId
      ? (meta('meta[name="title"]', 'meta[property="og:title"]') || article.title)
      : article.title, 1000),
    description: bounded(article.description, 1000),
    selection: selected,
    content: article.content,
    siteName: bounded(article.siteName, 1000),
    author: bounded(article.author, 1000),
    language: bounded(article.language, 100),
    youtube: undefined
  }

  if (youtubeId) {
    const timeParts = text(document.querySelector('.ytp-time-current')).split(':').map(Number)
    const currentTime = timeParts.every(Number.isFinite)
      ? timeParts.reduce((total, part) => total * 60 + part, 0)
      : 0
    const existingTranscript = transcriptFromPage()
    let transcript = existingTranscript.transcript
    let transcriptStatus = transcript
      ? (existingTranscript.truncated ? 'truncated' : 'captured')
      : 'unavailable'
    let transcriptSource = transcript ? 'page' : undefined
    let transcriptLanguage

    if (!transcript) {
      const trackState = captionTrackState()
      const [panelResult, trackResult] = await Promise.all([
        openTranscriptPanel(),
        trackState.kind === 'available'
          ? fetchCaptionTrack(trackState.track)
          : Promise.resolve(emptyTranscript())
      ])
      if (panelResult.transcript) {
        transcript = panelResult.transcript
        transcriptStatus = panelResult.truncated ? 'truncated' : 'captured'
        transcriptSource = 'page'
      } else if (trackResult.transcript) {
        transcript = trackResult.transcript
        transcriptStatus = trackResult.truncated ? 'truncated' : 'captured'
        transcriptSource = 'caption-track'
        transcriptLanguage = trackState.track?.languageCode || undefined
      } else if (panelResult.attempted || trackState.kind === 'available' || trackState.kind === 'stale') {
        transcriptStatus = 'failed'
      }
    }

    const channel = text(document.querySelector('ytd-channel-name a')) ||
      text(document.querySelector('ytd-channel-name #text')) ||
      text(document.querySelector('ytd-channel-name'))
    result.content = ''
    result.youtube = {
      videoId: youtubeId,
      channel: bounded(channel, 1000),
      timestampSeconds: currentTime || undefined,
      transcript: transcript || undefined,
      transcriptStatus,
      transcriptLanguage,
      transcriptSource
    }
    result.description = bounded(text(document.querySelector('#description')) || result.description, 1000)
  }

  globalThis.result = result
  return result
})()
