/**
 * 從 TipTap 文件 JSON 萃取所有規則引用的 id（type: 'mention' 節點的 attrs.id），去重。
 * 用於同步 entry_rule_ref。
 */
interface ProseNode {
  type?: string
  attrs?: { id?: unknown }
  content?: ProseNode[]
}

export function extractRuleIds(noteJson: string | null): string[] {
  if (!noteJson) return []
  let doc: ProseNode
  try {
    doc = JSON.parse(noteJson) as ProseNode
  } catch {
    return []
  }
  const ids = new Set<string>()
  const walk = (node: ProseNode | undefined): void => {
    if (!node) return
    if (node.type === 'mention' && typeof node.attrs?.id === 'string') {
      ids.add(node.attrs.id)
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return Array.from(ids)
}
