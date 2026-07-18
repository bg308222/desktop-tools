import { Badge } from '@mantine/core'
import type { EntryStatus } from '@shared/domain'

const MAP: Record<EntryStatus, { color: string; label: string }> = {
  empty: { color: 'gray', label: '待記錄' },
  recorded: { color: 'yellow', label: '已記錄（待復盤）' },
  reviewed: { color: 'green', label: '已復盤' },
}

export function StatusBadge({ status }: { status: EntryStatus }): JSX.Element {
  const { color, label } = MAP[status]
  return (
    <Badge color={color} variant="light" radius="sm">
      {label}
    </Badge>
  )
}
