import { app, BrowserWindow } from 'electron'

const target = process.env.TSUZUNE_GPU_PROBE_URL ?? 'http://127.0.0.1:4174/'

const timeout = (milliseconds) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`probe timed out after ${milliseconds} ms`)), milliseconds)
  })

async function run() {
  const window = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    await window.loadURL(target)
    const renderer = await Promise.race([
      window.webContents.executeJavaScript(`
        (async () => {
          let result = {}
          try {
          const canvas = document.createElement('canvas')
          const gl = canvas.getContext('webgl2')
          result = {
            secureContext: window.isSecureContext,
            userAgent: navigator.userAgent,
            webgl2: Boolean(gl),
            webgl2Extensions: gl ? gl.getSupportedExtensions().sort() : [],
            webgpu: Boolean(navigator.gpu)
          }

          if (!navigator.gpu) return result

          const adapter = await navigator.gpu.requestAdapter()
          result.adapter = Boolean(adapter)
          if (!adapter) return result

          result.adapterFeatures = [...adapter.features].sort()
          result.adapterLimits = {
            maxBufferSize: adapter.limits.maxBufferSize,
            maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
            maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
            maxTextureDimension3D: adapter.limits.maxTextureDimension3D
          }

          const firstDevice = await adapter.requestDevice()
          result.device = Boolean(firstDevice)
          firstDevice.destroy()
          const loss = await firstDevice.lost
          result.intentionalDeviceLoss = { reason: loss.reason, message: loss.message }

          const replacementAdapter = await navigator.gpu.requestAdapter()
          result.replacementAdapter = Boolean(replacementAdapter)
          const replacement = await replacementAdapter?.requestDevice()
          result.replacementDevice = Boolean(replacement)
          replacement?.destroy()
          return result
          } catch (error) {
            return {
              ...result,
              probeError: {
                name: error?.name ?? null,
                message: error?.message ?? String(error),
                stack: error?.stack ?? null
              }
            }
          }
        })()
      `),
      timeout(20_000)
    ])

    console.log(JSON.stringify({
      observedAt: new Date().toISOString(),
      target,
      processVersions: process.versions,
      renderer
    }, null, 2))
  } finally {
    window.destroy()
  }
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(JSON.stringify({
      name: error?.name ?? null,
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
      raw: String(error)
    }, null, 2))
    app.exit(1)
  })
