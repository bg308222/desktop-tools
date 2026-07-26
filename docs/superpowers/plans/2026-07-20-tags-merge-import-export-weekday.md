# rules→tags 合併 + 載入修正 + 匯入匯出 + 記錄頁只交易日 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。步驟 checkbox 追蹤。

**Goal:** 把 rules 併入 tags（tag 有內文/圖片、移除 rule 子系統與 TipTap）、修掉進頁載入閃爍、設定頁加匯入/匯出（tgz + 自動備份）、記錄頁切日只走交易日並停用六日。

**Tech Stack:** Nuxt 4 / Vue 3 / Nitro / better-sqlite3 / Vitest / `tar`。

## Global Constraints
- 套件 exact；繁中文案/註解。
- tag/rule 皆無資料 → schema 變更即可，不做資料 migration。
- migration 冪等（ALTER 補欄、DROP IF EXISTS）。
- 參考 spec：`docs/superpowers/specs/2026-07-20-tags-merge-import-export-weekday-design.md`。

路徑相對 `applications/trade-journal/`。

---

# Phase A — rules 併入 tags

### Task A1: domain
**Files:** Modify `shared/domain.ts`
- [ ] `Tag` 加 `body: string | null`。
- [ ] 新增 `export interface TagImage { id: string; tagId: string; filePath: string; sortOrder: number }`。
- [ ] 移除 `Rule` / `RuleGroup` / `RuleImage`。
- [ ] Commit。

### Task A2: schema + migration
**Files:** Modify `server/db/schema.ts`、`server/db/connection.ts`；Test `test/connection.test.ts`
- [ ] schema.ts：`tag` CREATE 加 `body TEXT,`；新增 `CREATE TABLE IF NOT EXISTS tag_image (id TEXT PRIMARY KEY, tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE, file_path TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);`；移除 `rule` / `rule_group` / `rule_image` / `entry_rule_ref` 四個 CREATE。
- [ ] connection.ts migration：加 `addColumnTag('body','body TEXT')`（比照 entry 的 addColumn，對 tag 做）；並在 migration 末加 `for (const t of ['entry_rule_ref','rule_image','rule','rule_group']) db.exec(\`DROP TABLE IF EXISTS ${t}\`)`。
- [ ] 測試（connection.test）：`tag` 有 `body`、`tag_image` 存在、四張 rule 表不存在（查 `sqlite_master`）。
- [ ] 紅→綠→Commit。

### Task A3: tagRepo（body + images），移除 ruleRepo
**Files:** Modify `server/db/repositories/tagRepo.ts`；Delete `server/db/repositories/ruleRepo.ts`；Test `test/tagRepo.test.ts`；Delete `test/ruleRepo.test.ts`
- [ ] `TagRow` 加 `body`；`list`/`ensure` 回傳含 `body`（ensure 新建時 body null）。
- [ ] 新增 `setBody(id, body: string | null)`；`addImage(tagId, filePath): TagImage`（`nextOrder`）；`listImages(tagId): TagImage[]`；`removeImage(id)`。`TagImageRow`→`toTagImage`。
- [ ] 測試加：setBody、addImage/listImages/removeImage。刪除 `test/ruleRepo.test.ts`。
- [ ] 紅→綠→Commit。

### Task A4: imageStore tag 圖、entryRepo setNote、移除 mention
**Files:** Modify `server/utils/imageStore.ts`、`server/api/entries/[id].patch.ts`；Delete `shared/mention.ts`、`test/mention.test.ts`
- [ ] imageStore：`writeRuleImage` 改名 `writeTagImage(tagId, buffer, ext)`，路徑 `images/tags/<tagId>/<uuid>.<ext>`。
- [ ] `[id].patch.ts`：移除 `import extractRuleIds`、移除 `rules.setEntryRuleRefs(...)`；`setNote` 只 `entries.setNote`。
- [ ] 刪 `shared/mention.ts` 與 `test/mention.test.ts`。
- [ ] typecheck（會有 API/useApi 未改的錯，下一任務處理）。Commit。

### Task A5: API 路由（移除 rules、擴充 tags/images）
**Files:** Delete `server/api/rules/**`、`server/api/rule-groups/**`、`server/api/rule-images/**`；Create `server/api/tags/[id].patch.ts`、`server/api/tags/[id]/images.get.ts`、`server/api/tag-images/[id].delete.ts`；Modify `server/api/images/index.post.ts`、`server/utils/repos.ts`
- [ ] `repos.ts`：移除 `rules: createRuleRepo(...)`；移除其 import。
- [ ] 刪 rules/rule-groups/rule-images 路由目錄。
- [ ] `tags/[id].patch.ts`：body `{ body?: string|null }` → `tags.setBody`。
- [ ] `tags/[id]/images.get.ts`：`tags.listImages(id)`。
- [ ] `tag-images/[id].delete.ts`：`tags.removeImage(id)`。
- [ ] `images/index.post.ts`：body 支援 `tagId` → `store.writeTagImage` + `tags.addImage`（移除 ruleId 分支）。
- [ ] typecheck。Commit。

### Task A6: useApi（移除 rules、擴充 tags）
**Files:** Modify `app/composables/useApi.ts`
- [ ] 移除 `rules` 群組與 `RuleGroup/Rule/RuleImage` import。
- [ ] `tags` 加：`setBody(id, body)`、`listImages(id)`、`removeImage(id)`、`pasteImage(tagId, dataUrl)`（POST /api/images 帶 tagId）。
- [ ] `images.pasteRuleImage` 移除。
- [ ] typecheck。Commit。

### Task A7: 移除 TipTap、備註改 textarea
**Files:** Delete `app/components/NoteEditor.vue`、`app/lib/mentionSuggestion.ts`；Modify `app/pages/index.vue`、`app/assets/css/main.css`、`package.json`
- [ ] 記錄頁備註區：`<NoteEditor>` → `<textarea v-model 綁 noteDraft>`（blur/debounce 存 `entries.setNote`）。移除 rules 載入與 `:rules` 傳遞。
- [ ] 刪 NoteEditor.vue、mentionSuggestion.ts。
- [ ] `bun remove @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit @tiptap/extension-mention @tiptap/suggestion`。
- [ ] main.css 移除 `.tj-note` / `.tj-mention*`。
- [ ] typecheck。Commit。

### Task A8: /rules → 標籤管理頁
**Files:** Modify `app/pages/rules.vue`→改內容（保留路徑或改 `app/pages/tags-manage.vue`？保留改造 `rules.vue` 內容並改路由）；Modify `app/components/AppSidebar.vue`；Delete `app/components/RuleEditor.vue`/`RuleThumb.vue`（改為 TagEditor/TagThumb 或直接改寫）
- [ ] 新增 `app/pages/manage.vue`（路由 `/manage`）作標籤管理；刪 `app/pages/rules.vue`。左側標籤清單（新增/選取），右側編輯：名稱（rename）、顏色、內文 textarea、附圖（貼上/拖放 → `tags.pasteImage`，grid + 刪除）。
- [ ] Sidebar：`{ to:'/manage', label:'標籤管理', icon:'🏷️' }` 取代 `/rules 交易規則`；`/tags` 維持「標籤」瀏覽。
- [ ] 刪 RuleEditor.vue / RuleThumb.vue（改寫為 manage 頁內元件或就地）。
- [ ] typecheck + 手動：新增標籤、設顏色/內文、貼圖。Commit。

### Task A9: mock 去 rules、tag 加 body/圖
**Files:** Modify `scripts/mock.ts`
- [ ] 移除 rule 群組/規則/refs 產生與 `extractRuleIds` import。
- [ ] tag 產生：對 2~3 個 tag `setBody` + 1 張示範圖（`writeTagImage` + `addImage`）。
- [ ] `just mock` 驗證輸出。Commit。

---

# Phase B — 載入閃爍修正

### Task B1: 記錄頁 loaded 狀態
**Files:** Modify `app/pages/index.vue`
- [ ] 加 `const loaded = ref(false)`；onMounted 首次載完 markets 後 `loaded.value = true`。
- [ ] template：最外層 `v-if="!loaded"` 顯示 loading（置中 spinner/文字「載入中…」）；`v-else-if="markets.length === 0"` 顯示「尚無市場」；`v-else` 正常。
- [ ] 手動驗證：進頁不再閃「請設定」。Commit。

---

# Phase C — 匯入 / 匯出

### Task C1: tar 依賴 + 打包/解包 util（含測試）
**Files:** Create `server/utils/archive.ts`；Test `test/archive.test.ts`；Modify `package.json`
- [ ] `bun add --exact tar`；`bun add --exact --dev @types/tar`。
- [ ] `archive.ts`：`packDir(dir): NodeJS.ReadableStream`（`tar.c({gzip:true, cwd:dir},['.'])`）；`extractTgzTo(file: string, dir: string): Promise<void>`（`tar.x({file, cwd:dir})`）。
- [ ] 測試：建暫存 dir 放檔 → pack 到暫存 tgz → extract 到另一 dir → 內容一致。
- [ ] 紅→綠→Commit。

### Task C2: resetRepos + export/import 路由
**Files:** Modify `server/utils/repos.ts`；Create `server/api/app/export.get.ts`、`server/api/app/import.post.ts`
- [ ] `repos.ts`：加 `export function resetRepos() { cached?.db.close(); cached = null }`。
- [ ] `export.get.ts`：`setResponseHeader` Content-Type `application/gzip`、`Content-Disposition attachment; filename=trade-journal-<yyyymmdd-HHmm>.tgz`；`return packDir(dataDir)`（需先 debounce 無關；DB 為即時寫檔，直接打包 dataDir）。
- [ ] `import.post.ts`：`readMultipartFormData` 取檔 → 寫暫存 tgz → 複製現有 `dataDir` 到 `dataDir/../data-bak-<yyyymmdd-HHmmss>` → 清空 dataDir → `extractTgzTo` → `resetRepos()` → 回 `{ ok:true }`。
- [ ] 手動：curl export 下載、import 上傳（先備份）。Commit。

### Task C3: 設定頁匯入/匯出 UI
**Files:** Modify `app/pages/settings.vue`
- [ ] 「資料備份」卡片：兩顆按鈕。
  - 匯出：`<a href="/api/app/export">` 或 `window.location='/api/app/export'` 觸發下載。
  - 匯入：隱藏 `<input type=file accept=.tgz,.gz>` + 按鈕；選檔 → `confirm('匯入會覆蓋現有資料（已自動先備份），確定？')` → `FormData` `POST /api/app/import` → 成功 `location.reload()`。
- [ ] 手動驗證。Commit。

---

# Phase D — 記錄頁只交易日

### Task D1: 切日跳過六日 + datepicker 停用六日
**Files:** Modify `app/pages/index.vue`
- [ ] `moveDate(dir)`：從 curDate 往 dir 找下一個非六日：
  ```ts
  let d = dayjs(curDate.value).add(dir, 'day')
  while (d.day() === 0 || d.day() === 6) d = d.add(dir, 'day')
  curDate.value = d.format('YYYY-MM-DD')
  ```
- [ ] 初始 curDate：`session.record.date ?? snapWeekday(today)`，`snapWeekday`：若六日往前退到週五。
- [ ] datepicker：`<input type=date>` 換 `UPopover + UCalendar`，`:is-date-unavailable="(d)=>{const w=new Date(d.toString()).getDay(); return w===0||w===6}"`，`@update:model-value` 設 curDate（用 viewer 同款 onCalUpdate/parseDate）。按鈕顯示 `dayjs(curDate).format('M/D 週X')`。
- [ ] 手動：←→ 從週五跳週一、datepicker 六日灰掉。Commit。

---

# Phase E — 全面驗證
- [ ] `bun run test` 全綠（含新 tag/archive、移除 rule/mention）。
- [ ] `bun run typecheck` 通過。
- [ ] `bun run build` 成功。
- [ ] `just mock` → `just dev`：載入不閃、標籤管理（內文/圖）、備註純文字、記錄頁只交易日、匯出下載、匯入覆蓋+自動備份、復盤/標籤頁正常。

---

## Self-Review
- Spec A（tag body/image、移 rule、TipTap、textarea、/manage）→ A1–A9 ✓
- Spec B（loading）→ B1 ✓
- Spec C（tgz 匯入匯出 + 自動備份 + resetRepos）→ C1–C3 ✓
- Spec D（切日跳六日 + datepicker 停用六日 + 預設 snap）→ D1 ✓
- 無資料 migration：A2 僅 schema（ALTER + DROP）✓
- 型別一致：`Tag.body`、`TagImage`、`tags.setBody/addImage/listImages/removeImage`、`writeTagImage`、`resetRepos`、`packDir/extractTgzTo` 跨任務一致 ✓
