export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function imageFileFromPaste(e: React.ClipboardEvent): File | null {
  const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
  return item?.getAsFile() ?? null
}

export function imageFileFromDrop(e: React.DragEvent): File | null {
  return Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')) ?? null
}
