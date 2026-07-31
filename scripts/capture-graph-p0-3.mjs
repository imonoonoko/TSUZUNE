import { app, BrowserWindow } from 'electron'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = resolve('docs/reports/assets/graph-p0-3')
const originalLoadFile = BrowserWindow.prototype.loadFile
let captureStarted = false

process.env.TSUZUNE_HEADLESS_SMOKE = '1'
app.setPath('userData', resolve(process.env.APPDATA || '', 'tsuzune'))

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function evaluate(window, expression) {
  return window.webContents.executeJavaScript(expression, true)
}

async function waitForRender(window) {
  await delay(250)
  await evaluate(
    window,
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  )
}

async function clickButton(window, label) {
  const clicked = await evaluate(
    window,
    `(() => {
      const button = [...document.querySelectorAll('button')].find(
        (candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)} ||
          candidate.textContent.trim() === ${JSON.stringify(label)}
      )
      if (!button) return false
      button.click()
      return true
    })()`
  )
  if (!clicked) {
    throw new Error(`ボタン「${label}」が見つかりませんでした。`)
  }
  await waitForRender(window)
}

async function fillSearch(window, value) {
  const appliedValue = await evaluate(
    window,
    `(() => {
      const input = document.querySelector('[aria-label="グラフを絞り込み"]')
      if (!input) return null
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set
      input.focus()
      setter.call(input, ${JSON.stringify(value)})
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: ${JSON.stringify(value)},
        inputType: 'insertText'
      }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return input.value
    })()`
  )
  if (appliedValue !== value) {
    throw new Error(`絞り込み入力を設定できませんでした: ${appliedValue}`)
  }
  await waitForRender(window)
}

async function capture(window, name) {
  const image = await window.webContents.capturePage()
  await writeFile(resolve(outputDirectory, name), image.toPNG())
}

async function graphState(window) {
  return evaluate(
    window,
    `(() => ({
      filter: document.querySelector('[aria-label="グラフを絞り込み"]')?.value || '',
      zoom: [...document.querySelectorAll('[aria-live="polite"]')]
        .map((element) => element.textContent.trim())
        .find((text) => text.startsWith('表示倍率')) || '',
      transform: document.querySelector('.wiki-graph-stage')?.style.transform || '',
      nodes: [...document.querySelectorAll('.wiki-graph-node')]
        .map((node) => node.textContent.trim()),
      edges: [...document.querySelectorAll('[data-source-path][data-target-path]')]
        .map((edge) => ({
          sourcePath: edge.getAttribute('data-source-path'),
          targetPath: edge.getAttribute('data-target-path')
        }))
    }))()`
  )
}

async function captureGraphReport(window) {
  await mkdir(outputDirectory, { recursive: true })
  await evaluate(
    window,
    `new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000
      const timer = setInterval(() => {
        const graphButton = [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'グラフ')
        if (graphButton) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(timer)
          reject(new Error('TSUZUNEの起動を待機できませんでした。'))
        }
      }, 100)
    })`
  )

  await clickButton(window, '編集')
  await clickButton(window, 'グラフ')

  await fillSearch(window, 'ONOKO')
  await capture(window, '01-filter-onoko.png')
  const filtered = await graphState(window)

  await fillSearch(window, '')
  await clickButton(window, '拡大')
  await clickButton(window, '拡大')
  await capture(window, '02-zoom-140.png')
  const zoomed = await graphState(window)

  const canvas = await evaluate(
    window,
    `(() => {
      const bounds = document.querySelector('[aria-label="グラフキャンバス"]').getBoundingClientRect()
      return { x: bounds.x + 24, y: bounds.y + 24 }
    })()`
  )
  window.webContents.sendInputEvent({
    type: 'mouseDown',
    x: canvas.x,
    y: canvas.y,
    button: 'left',
    clickCount: 1
  })
  window.webContents.sendInputEvent({
    type: 'mouseMove',
    x: canvas.x + 90,
    y: canvas.y + 55
  })
  window.webContents.sendInputEvent({
    type: 'mouseUp',
    x: canvas.x + 90,
    y: canvas.y + 55,
    button: 'left',
    clickCount: 1
  })
  await waitForRender(window)
  await capture(window, '03-pan.png')
  const panned = await graphState(window)

  await clickButton(window, '全体表示')
  await capture(window, '04-fit.png')
  const fitted = await graphState(window)

  if (filtered.filter !== 'ONOKO' || filtered.nodes.length !== 2) {
    throw new Error('名前・パス絞り込みの実画面結果が期待値と一致しません。')
  }
  if (zoomed.zoom !== '表示倍率 140%' || !zoomed.transform.includes('scale(1.4)')) {
    throw new Error('ズームの実画面結果が期待値と一致しません。')
  }
  if (panned.transform === zoomed.transform) {
    throw new Error('背景ドラッグでグラフが移動しませんでした。')
  }
  if (
    fitted.zoom !== '表示倍率 100%' ||
    fitted.transform !== 'translate(0px, 0px) scale(1)'
  ) {
    throw new Error('全体表示で表示状態を復帰できませんでした。')
  }

  const result = { filtered, zoomed, panned, fitted }
  await writeFile(
    resolve(outputDirectory, 'capture-result.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  )
  await Promise.all([
    rm(resolve(outputDirectory, 'capture-error.txt'), { force: true }),
    rm(resolve(outputDirectory, 'capture-error.png'), { force: true })
  ])
  console.log(JSON.stringify(result, null, 2))
}

BrowserWindow.prototype.loadFile = function (...args) {
  const loaded = originalLoadFile.apply(this, args)
  if (!captureStarted) {
    captureStarted = true
    void loaded
      .then(() => captureGraphReport(this))
      .then(() => app.exit(0))
      .catch(async (error) => {
        await mkdir(outputDirectory, { recursive: true })
        const rendererText = await this.webContents
          .executeJavaScript('document.body?.innerText || ""', true)
          .catch(() => '')
        await writeFile(
          resolve(outputDirectory, 'capture-error.txt'),
          `${String(error?.stack || error)}\n\nURL: ${this.webContents.getURL()}\n\n${rendererText}`,
          'utf8'
        )
        const errorImage = await this.webContents.capturePage()
        await writeFile(
          resolve(outputDirectory, 'capture-error.png'),
          errorImage.toPNG()
        )
        console.error(error)
        app.exit(1)
      })
  }
  return loaded
}

await import('../out/main/index.js')
