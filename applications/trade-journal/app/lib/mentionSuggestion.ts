import type {
  SuggestionOptions,
  SuggestionProps,
  SuggestionKeyDownProps,
} from '@tiptap/suggestion'
import type { Rule } from '../../shared/domain'

interface Attrs {
  id: string
  label: string | null
}

/** 建立 @ 規則提及的 suggestion 設定（純 DOM 彈窗，不依賴 tippy）。 */
export function createRuleSuggestion(
  getRules: () => Rule[],
): Omit<SuggestionOptions<Rule, Attrs>, 'editor'> {
  return {
    items: ({ query }): Rule[] => {
      const q = query.toLowerCase()
      return getRules()
        .filter((r) => r.name.toLowerCase().includes(q))
        .slice(0, 8)
    },
    render: () => {
      let el: HTMLDivElement | null = null
      let items: Rule[] = []
      let selected = 0
      let command: (attrs: Attrs) => void = () => {}

      const paint = (): void => {
        if (!el) return
        el.innerHTML = ''
        if (items.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'tj-mention-empty'
          empty.textContent = '找不到符合的規則'
          el.appendChild(empty)
          return
        }
        items.forEach((r, i) => {
          const item = document.createElement('div')
          item.className = 'tj-mention-item' + (i === selected ? ' active' : '')
          const name = document.createElement('span')
          name.className = 'tj-mi-name'
          name.textContent = r.name
          item.appendChild(name)
          item.addEventListener('mousedown', (ev) => {
            ev.preventDefault()
            command({ id: r.id, label: r.name })
          })
          el?.appendChild(item)
        })
      }

      const position = (rect: DOMRect | null | undefined): void => {
        if (!el || !rect) return
        el.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`
        el.style.top = `${rect.bottom + 6}px`
      }

      return {
        onStart: (props: SuggestionProps<Rule, Attrs>) => {
          el = document.createElement('div')
          el.className = 'tj-mention-pop'
          document.body.appendChild(el)
          items = props.items
          command = props.command
          selected = 0
          paint()
          position(props.clientRect?.())
        },
        onUpdate: (props: SuggestionProps<Rule, Attrs>) => {
          items = props.items
          command = props.command
          selected = 0
          paint()
          position(props.clientRect?.())
        },
        onKeyDown: (props: SuggestionKeyDownProps): boolean => {
          const { key } = props.event
          if (key === 'ArrowDown') {
            selected = items.length ? (selected + 1) % items.length : 0
            paint()
            return true
          }
          if (key === 'ArrowUp') {
            selected = items.length ? (selected - 1 + items.length) % items.length : 0
            paint()
            return true
          }
          if (key === 'Enter') {
            const r = items[selected]
            if (r) command({ id: r.id, label: r.name })
            return true
          }
          if (key === 'Escape') {
            el?.remove()
            el = null
            return true
          }
          return false
        },
        onExit: () => {
          el?.remove()
          el = null
        },
      }
    },
  }
}
