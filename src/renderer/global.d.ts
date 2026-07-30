import type { TsuzuneApi } from '../shared/types'

declare global {
  interface Window {
    tsuzune: TsuzuneApi
  }
}

export {}
