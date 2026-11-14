export interface PdfExportOptions {
  suggestedName: string
  pageSize: 'A4' | 'Letter'
  landscape: boolean
}

export type PdfExportResult = { canceled: true } | { canceled: false; path: string }
