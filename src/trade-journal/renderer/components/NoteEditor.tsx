import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import type { Rule } from '@shared/domain'
import { createRuleSuggestion } from './mentionSuggestion'
import './noteEditor.css'

interface Props {
  json: string | null
  rules: Rule[]
  onChange: (json: string) => void
}

function parseDoc(json: string | null): object | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as object
  } catch {
    return undefined
  }
}

export function NoteEditor({ json, rules, onChange }: Props): JSX.Element {
  // 讓 renderHTML / suggestion 讀到最新的 rules（extension 只建立一次）。
  const rulesRef = useRef<Rule[]>(rules)
  rulesRef.current = rules
  const lookup = (id: string): string | null => rulesRef.current.find((r) => r.id === id)?.name ?? null

  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: { class: 'tj-mention' },
        renderHTML({ options, node }) {
          const name = lookup(node.attrs.id as string) ?? (node.attrs.label as string) ?? '已刪除規則'
          return ['span', mergeAttributes(options.HTMLAttributes, { 'data-id': node.attrs.id as string }), name]
        },
        renderText({ node }) {
          return lookup(node.attrs.id as string) ?? (node.attrs.label as string) ?? '已刪除規則'
        },
        suggestion: createRuleSuggestion(() => rulesRef.current),
      }),
    ],
    content: parseDoc(json),
    onUpdate: ({ editor: ed }) => {
      onChange(JSON.stringify(ed.getJSON()))
    },
  })

  // 切換 entry（外部 json 變更）時，載入新內容。
  const lastJson = useRef<string | null>(json)
  useEffect(() => {
    if (!editor) return
    if (json !== lastJson.current) {
      lastJson.current = json
      editor.commands.setContent(parseDoc(json) ?? '')
    }
  }, [json, editor])

  return (
    <div className="tj-note">
      <EditorContent editor={editor} />
    </div>
  )
}
