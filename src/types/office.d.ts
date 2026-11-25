declare module 'mammoth' {
  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer
  }): Promise<{ value: string; messages: unknown[] }>
}

declare module 'html-to-docx' {
  export default function HTMLtoDOCX(
    html: string,
    headerHTML?: string | null,
    options?: Record<string, unknown>,
  ): Promise<ArrayBuffer | Blob>
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string }
  export function getDocument(src: unknown): {
    promise: Promise<{
      numPages: number
      getPage: (pageNumber: number) => Promise<{
        getViewport: (params: { scale: number }) => { width: number; height: number }
        render: (params: Record<string, unknown>) => { promise: Promise<void> }
      }>
      destroy?: () => Promise<void>
    }>
  }
  export const version: string
}
