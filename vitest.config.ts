import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // These process entrypoints are exercised by packaged/MCP smoke checks.
      // Importing them in unit tests would start Electron, stdio, or production
      // relocation side effects instead of testing a bounded unit contract.
      exclude: [
        'src/cli/production-classification-runner.ts',
        'src/main/index.ts',
        'src/mcp/server.ts'
      ],
      reporter: ['text', 'html']
    }
  }
})
