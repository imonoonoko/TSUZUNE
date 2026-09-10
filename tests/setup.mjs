const rangePrototype = globalThis.Range?.prototype

if (rangePrototype && typeof rangePrototype.getClientRects !== 'function') {
  Object.defineProperty(rangePrototype, 'getClientRects', {
    configurable: true,
    value: () => []
  })
}
