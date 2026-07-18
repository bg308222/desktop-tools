import { useEffect, useState } from 'react'
import { Box, Group, Stack, Text } from '@mantine/core'
import { api } from '../api'
import type { ImageKind } from '@shared/domain'

export type ViewerMode = 1 | 2 | 3
export type SlotPaths = Record<ImageKind, string | null>

const LABEL: Record<ImageKind, string> = { trade: '交易圖', raw: '原圖', review: '復盤圖' }

function ImageView({ relPath, kind }: { relPath: string | null; kind: ImageKind }): JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

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

  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        position: 'relative',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--mantine-color-default)',
      }}
    >
      <Text
        size="xs"
        fw={600}
        c="dimmed"
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          padding: '3px 9px',
          borderRadius: 6,
          border: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
        }}
      >
        {LABEL[kind]}
      </Text>
      {relPath && src ? (
        <img src={src} alt={LABEL[kind]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      ) : (
        <Stack align="center" gap={6}>
          <Text size="28px" style={{ opacity: 0.5 }}>
            🖼
          </Text>
          <Text size="sm" c="dimmed">
            {missing ? `${LABEL[kind]}遺失` : `尚未上傳${LABEL[kind]}`}
          </Text>
        </Stack>
      )}
    </Box>
  )
}

export function ViewerStage({
  images,
  mode,
  singleKind,
}: {
  images: SlotPaths
  mode: ViewerMode
  singleKind: ImageKind
}): JSX.Element {
  let a: ImageKind
  let b: ImageKind | null = null
  if (mode === 1) a = singleKind
  else if (mode === 2) {
    a = 'raw'
    b = 'review'
  } else {
    a = 'review'
    b = 'trade'
  }

  return (
    <Group gap="md" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
      <ImageView relPath={images[a]} kind={a} />
      {b && <ImageView relPath={images[b]} kind={b} />}
    </Group>
  )
}
