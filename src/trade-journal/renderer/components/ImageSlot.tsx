import { useEffect, useRef, useState } from 'react'
import { Box, Group, Stack, Text } from '@mantine/core'
import { api } from '../api'
import { fileToDataUrl, imageFileFromDrop, imageFileFromPaste } from '../lib/file'

interface Props {
  label: string
  relPath: string | null
  onImage: (dataUrl: string) => void
  onRemove?: () => void
}

export function ImageSlot({ label, relPath, onImage, onRemove }: Props): JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    if (relPath) {
      void api.images.readDataUrl(relPath).then((d) => {
        if (!alive) return
        setSrc(d)
        setMissing(d === null)
      })
    } else {
      setSrc(null)
      setMissing(false)
    }
    return () => {
      alive = false
    }
  }, [relPath])

  const handlePaste = async (e: React.ClipboardEvent): Promise<void> => {
    const file = imageFileFromPaste(e)
    if (file) {
      e.preventDefault()
      onImage(await fileToDataUrl(file))
    }
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    const file = imageFileFromDrop(e)
    if (file) onImage(await fileToDataUrl(file))
  }

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (file) onImage(await fileToDataUrl(file))
    e.target.value = ''
  }

  const hasImage = !!relPath && !!src && !missing

  return (
    <Box
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-default)',
      }}
    >
      <Group justify="space-between" px="sm" py={6} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="sm" fw={600} c="dimmed">
          {label}
        </Text>
        {hasImage && onRemove && (
          <Text size="xs" c="teal" style={{ cursor: 'pointer' }} onClick={onRemove}>
            ↻ 重新貼上
          </Text>
        )}
      </Group>

      <Box
        tabIndex={0}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => {
          if (!hasImage) fileRef.current?.click()
        }}
        style={{
          minHeight: 170,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: hasImage ? 'default' : 'pointer',
          outline: 'none',
          padding: hasImage ? 0 : 12,
        }}
      >
        {hasImage ? (
          <img src={src as string} alt={label} style={{ maxWidth: '100%', maxHeight: 320, display: 'block' }} />
        ) : missing ? (
          <Stack align="center" gap={6}>
            <Text size="xl">⚠️</Text>
            <Text size="sm" c="dimmed">
              圖片遺失，可重新上傳
            </Text>
          </Stack>
        ) : (
          <Stack align="center" gap={6}>
            <Text size="28px">🖼</Text>
            <Text size="sm" fw={500} c="dimmed">
              貼上 {label}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              Ctrl / ⌘ + V · 或拖放 · 或點擊選檔
            </Text>
          </Stack>
        )}
      </Box>

      <input type="file" accept="image/*" hidden ref={fileRef} onChange={handlePick} />
    </Box>
  )
}
