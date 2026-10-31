import type { WltKind } from './wlt'

/** W／L／T 的配色（Tailwind class），記錄頁、設定頁、查詢共用。 */
export const WLT_STYLE: Record<WltKind, { text: string; bar: string; soft: string }> = {
  W: {
    text: 'text-green-600 dark:text-green-400',
    bar: 'bg-green-500/70',
    soft: 'bg-green-500/10 border-green-500/50',
  },
  L: {
    text: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500/70',
    soft: 'bg-red-500/10 border-red-500/50',
  },
  T: {
    text: 'text-yellow-600 dark:text-yellow-400',
    bar: 'bg-yellow-400/70',
    soft: 'bg-yellow-400/10 border-yellow-500/50',
  },
}
