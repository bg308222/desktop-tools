export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function imageFileFromPaste(e: ClipboardEvent): File | null {
  const items = e.clipboardData ? Array.from(e.clipboardData.items) : []
  const item = items.find((i) => i.type.startsWith('image/'))
  return item?.getAsFile() ?? null
}

export function imageFileFromDrop(e: DragEvent): File | null {
  const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : []
  return files.find((f) => f.type.startsWith('image/')) ?? null
}
