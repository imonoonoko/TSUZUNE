export interface CanvasPngExportOptions { suggestedName: string; png: string }
export type CanvasPngExportResult = { canceled: true } | { canceled: false; path: string }
