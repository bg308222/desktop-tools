<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import type { Rule } from '../../shared/domain'
import { createRuleSuggestion } from '../lib/mentionSuggestion'

const props = defineProps<{ modelValue: string | null; rules: Rule[] }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

// 讓 renderHTML / suggestion 讀到最新的 rules（extension 只建立一次）。
const rulesRef = ref<Rule[]>(props.rules)
watch(
  () => props.rules,
  (r) => {
    rulesRef.value = r
  },
)
const lookup = (id: string): string | null =>
  rulesRef.value.find((r) => r.id === id)?.name ?? null

function parseDoc(json: string | null): object | undefined {
  if (!json) return undefined
  try {
    return JSON.parse(json) as object
  } catch {
    return undefined
  }
}

let lastJson: string | null = props.modelValue

const editor = useEditor({
  content: parseDoc(props.modelValue),
  extensions: [
    StarterKit,
    Mention.configure({
      HTMLAttributes: { class: 'tj-mention' },
      renderHTML({ options, node }) {
        const name =
          lookup(node.attrs.id as string) ?? (node.attrs.label as string) ?? '已刪除規則'
        return [
          'span',
          mergeAttributes(options.HTMLAttributes, { 'data-id': node.attrs.id as string }),
          name,
        ]
      },
      renderText({ node }) {
        return lookup(node.attrs.id as string) ?? (node.attrs.label as string) ?? '已刪除規則'
      },
      // TipTap 版本間 suggestion 泛型（attrs）型別差異，於邊界處放寬
      suggestion: createRuleSuggestion(() => rulesRef.value) as never,
    }),
  ],
  onUpdate: ({ editor: ed }) => {
    lastJson = JSON.stringify(ed.getJSON())
    emit('update:modelValue', lastJson)
  },
})

// 切換 entry（外部 modelValue 變更）時，載入新內容。
watch(
  () => props.modelValue,
  (json) => {
    if (!editor.value) return
    if (json !== lastJson) {
      lastJson = json
      editor.value.commands.setContent(parseDoc(json) ?? '')
    }
  },
)

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div class="tj-note">
    <EditorContent :editor="editor" />
  </div>
</template>
