import { Group, NumberInput } from '@mantine/core'
import type { Wlt } from '@shared/domain'

const KEYS: { k: keyof Wlt; label: string; color: string }[] = [
  { k: 'w', label: 'W', color: 'var(--mantine-color-green-6)' },
  { k: 'l', label: 'L', color: 'var(--mantine-color-red-6)' },
  { k: 't', label: 'T', color: 'var(--mantine-color-yellow-6)' },
]

interface Props {
  value: Wlt | null
  disabled?: boolean
  onChange: (v: Wlt) => void
}

export function WltStepper({ value, disabled, onChange }: Props): JSX.Element {
  const v = value ?? { w: 0, l: 0, t: 0 }
  const set = (k: keyof Wlt, n: number): void => onChange({ ...v, [k]: Math.max(0, Math.floor(n || 0)) })

  return (
    <Group gap="sm">
      {KEYS.map(({ k, label, color }) => (
        <NumberInput
          key={k}
          label={label}
          value={value ? v[k] : ''}
          min={0}
          step={1}
          disabled={disabled}
          w={84}
          placeholder="–"
          onChange={(val) => set(k, typeof val === 'number' ? val : Number(val) || 0)}
          styles={{ label: { color, fontWeight: 700 } }}
        />
      ))}
    </Group>
  )
}
