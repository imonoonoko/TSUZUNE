// @vitest-environment jsdom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reactDom = vi.hoisted(() => {
  const render = vi.fn()
  const createRoot = vi.fn(() => ({ render }))
  return { createRoot, render }
})

vi.mock('react-dom/client', () => ({
  default: { createRoot: reactDom.createRoot },
  createRoot: reactDom.createRoot
}))

vi.mock('../src/renderer/App', () => ({
  default: () => null
}))

describe('renderer entrypoint', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    vi.clearAllMocks()
  })

  it('mounts the application into the root element under StrictMode', async () => {
    await import('../src/renderer/src')

    const root = document.getElementById('root')
    expect(reactDom.createRoot).toHaveBeenCalledWith(root)
    expect(reactDom.render).toHaveBeenCalledOnce()
    expect(reactDom.render.mock.calls[0][0].type).toBe(React.StrictMode)
  })
})
