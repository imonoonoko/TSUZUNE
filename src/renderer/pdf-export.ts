export function preparePdfContent(root: HTMLElement): void {
  root.querySelectorAll<HTMLDetailsElement>('details.callout').forEach(details => { details.open = true })
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
    if (!/^https?:\/\//i.test(link.getAttribute('href') ?? '')) link.removeAttribute('href')
  })
}

export function waitForPdfReady(root: HTMLElement, { timeoutMs = 30_000, signal }: {
  timeoutMs?: number
  signal?: AbortSignal
} = {}): Promise<void> {
  preparePdfContent(root)
  return new Promise((resolve, reject) => {
    let finished = false
    let decoding = false
    let timer: ReturnType<typeof setTimeout>
    const finish = (error?: Error): void => {
      if (finished) return
      finished = true
      clearTimeout(timer); clearTimeout(deadline)
      signal?.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    const abort = (): void => finish(new Error('PDF書き出しを中止しました。'))
    const deadline = setTimeout(() => finish(new Error('PDFの準備が終わりませんでした。画像や図を確認して、もう一度お試しください。')), timeoutMs)
    const check = (): void => {
      if (finished || decoding) return
      if (signal?.aborted) { abort(); return }
      const images = [...root.querySelectorAll('img')]
      if (document.fonts?.status === 'loading' || root.querySelector('.vault-image-status, .mermaid-diagram[role="status"]') || images.some(img => !img.complete)) {
        timer = setTimeout(check, 50)
        return
      }
      if (images.some(img => img.naturalWidth === 0)) { finish(new Error('画像を読み込めないためPDFを保存できません。プレビューを確認してください。')); return }
      decoding = true
      void Promise.all(images.map(img => img.decode?.())).then(() => {
        if (signal?.aborted) { abort(); return }
        preparePdfContent(root)
        finish()
      }, () => finish(new Error('画像の準備に失敗しました。')))
    }
    signal?.addEventListener('abort', abort, { once: true })
    check()
  })
}
