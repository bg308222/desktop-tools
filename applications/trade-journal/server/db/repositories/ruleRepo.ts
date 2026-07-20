import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { Rule, RuleGroup, RuleImage } from '../../../shared/domain'

interface GroupRow {
  id: string
  name: string
  sort_order: number
}
interface RuleRow {
  id: string
  group_id: string
  name: string
  body_json: string | null
  sort_order: number
}
interface RuleImageRow {
  id: string
  rule_id: string
  file_path: string
  sort_order: number
}

const toGroup = (r: GroupRow): RuleGroup => ({ id: r.id, name: r.name, sortOrder: r.sort_order })
const toRule = (r: RuleRow): Rule => ({
  id: r.id,
  groupId: r.group_id,
  name: r.name,
  bodyJson: r.body_json,
  sortOrder: r.sort_order,
})
const toRuleImage = (r: RuleImageRow): RuleImage => ({
  id: r.id,
  ruleId: r.rule_id,
  filePath: r.file_path,
  sortOrder: r.sort_order,
})

export function createRuleRepo(db: Db) {
  const nextOrder = (table: string, where: string, params: Record<string, string>): number =>
    db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM ${table} ${where}`).get<{ n: number }>(params)
      ?.n ?? 0

  return {
    listGroups(): RuleGroup[] {
      return db.prepare(`SELECT * FROM rule_group ORDER BY sort_order, name`).all<GroupRow>().map(toGroup)
    },
    createGroup(name: string): RuleGroup {
      const id = randomUUID()
      const so = nextOrder('rule_group', '', {})
      db.prepare(`INSERT INTO rule_group (id, name, sort_order) VALUES (:id, :name, :so)`).run({ id, name, so })
      return { id, name, sortOrder: so }
    },
    reorderGroups(ids: string[]): void {
      db.transaction(() => {
        ids.forEach((id, i) => db.prepare(`UPDATE rule_group SET sort_order = :so WHERE id = :id`).run({ id, so: i }))
      })
    },

    listRules(): Rule[] {
      return db.prepare(`SELECT * FROM rule ORDER BY sort_order, name`).all<RuleRow>().map(toRule)
    },
    getRule(id: string): Rule | null {
      const r = db.prepare(`SELECT * FROM rule WHERE id = :id`).get<RuleRow>({ id })
      return r ? toRule(r) : null
    },
    createRule(groupId: string, name: string): Rule {
      const id = randomUUID()
      const so = nextOrder('rule', 'WHERE group_id = :g', { g: groupId })
      db.prepare(`INSERT INTO rule (id, group_id, name, sort_order) VALUES (:id, :g, :name, :so)`).run({
        id,
        g: groupId,
        name,
        so,
      })
      return { id, groupId, name, bodyJson: null, sortOrder: so }
    },
    updateRule(id: string, patch: { name?: string; bodyJson?: string | null }): void {
      const sets: string[] = []
      const params: Record<string, string | null> = { id }
      if ('name' in patch && patch.name !== undefined) {
        sets.push('name = :name')
        params.name = patch.name
      }
      if ('bodyJson' in patch) {
        sets.push('body_json = :body')
        params.body = patch.bodyJson ?? null
      }
      if (sets.length === 0) return
      sets.push(`updated_at = datetime('now')`)
      db.prepare(`UPDATE rule SET ${sets.join(', ')} WHERE id = :id`).run(params)
    },
    moveRule(id: string, groupId: string): void {
      db.prepare(`UPDATE rule SET group_id = :g WHERE id = :id`).run({ id, g: groupId })
    },
    deleteRule(id: string): void {
      db.prepare(`DELETE FROM rule WHERE id = :id`).run({ id })
    },

    addRuleImage(ruleId: string, filePath: string): RuleImage {
      const id = randomUUID()
      const so = nextOrder('rule_image', 'WHERE rule_id = :r', { r: ruleId })
      db.prepare(`INSERT INTO rule_image (id, rule_id, file_path, sort_order) VALUES (:id, :r, :f, :so)`).run({
        id,
        r: ruleId,
        f: filePath,
        so,
      })
      return { id, ruleId, filePath, sortOrder: so }
    },
    listRuleImages(ruleId: string): RuleImage[] {
      return db
        .prepare(`SELECT * FROM rule_image WHERE rule_id = :r ORDER BY sort_order`)
        .all<RuleImageRow>({ r: ruleId })
        .map(toRuleImage)
    },
    removeRuleImage(id: string): void {
      db.prepare(`DELETE FROM rule_image WHERE id = :id`).run({ id })
    },

    setEntryRuleRefs(entryId: string, ruleIds: string[]): void {
      db.transaction(() => {
        db.prepare(`DELETE FROM entry_rule_ref WHERE entry_id = :e`).run({ e: entryId })
        for (const ruleId of ruleIds) {
          db.prepare(`INSERT OR IGNORE INTO entry_rule_ref (entry_id, rule_id) VALUES (:e, :r)`).run({
            e: entryId,
            r: ruleId,
          })
        }
      })
    },
    entriesReferencing(ruleId: string): string[] {
      return db
        .prepare(`SELECT entry_id FROM entry_rule_ref WHERE rule_id = :r`)
        .all<{ entry_id: string }>({ r: ruleId })
        .map((row) => row.entry_id)
    },
  }
}

export type RuleRepo = ReturnType<typeof createRuleRepo>
