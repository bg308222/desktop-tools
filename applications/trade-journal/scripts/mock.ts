/**
 * 產生一整套「夠真實」的 demo 假資料，供體驗前端操作使用。
 * 直接寫入 DATA_DIR 的 journal.db 與圖片資料夾（用既有 repository / imageStore）。
 * 執行：just mock trade-journal（以 tsx 在 Node 下跑；better-sqlite3 為 node 原生模組）。
 *
 * 會先清空既有資料，確保每次產出一致的 demo。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import dayjs from 'dayjs'
import { openDb } from '../server/db/connection'
import { createMarketRepo } from '../server/db/repositories/marketRepo'
import { createEntryRepo } from '../server/db/repositories/entryRepo'
import { createImageRepo } from '../server/db/repositories/imageRepo'
import { createTagRepo } from '../server/db/repositories/tagRepo'
import { createRuleRepo } from '../server/db/repositories/ruleRepo'
import { createImageStore } from '../server/utils/imageStore'
import { extractRuleIds } from '../shared/mention'
import type { ImageKind, Wlt } from '../shared/domain'

const dataDir = process.env.DATA_DIR || './data'

// ── 種子亂數（可重現） ──────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}
const rand = rng(20260720)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!
const chance = (p: number) => rand() < p

// ── SVG K 線圖產生器（每張圖依 seed 不同，看起來像真的走勢圖） ──
const KIND_LABEL: Record<ImageKind, string> = { trade: '交易', raw: '原圖', review: '復盤' }

function candlesSvg(seed: number, kind: ImageKind, caption: string): string {
  const r = rng(seed)
  const W = 640
  const H = 360
  const padL = 12
  const padR = 12
  const padT = 34
  const padB = 16
  const n = 26
  let price = 100 + r() * 40
  const candles: { o: number; c: number; hi: number; lo: number }[] = []
  let min = price
  let max = price
  for (let i = 0; i < n; i++) {
    const o = price
    const drift = (r() - 0.48) * 6
    const c = Math.max(1, o + drift)
    const hi = Math.max(o, c) + r() * 3
    const lo = Math.min(o, c) - r() * 3
    candles.push({ o, c, hi, lo })
    price = c
    min = Math.min(min, lo)
    max = Math.max(max, hi)
  }
  const span = max - min || 1
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const step = plotW / n
  const cw = step * 0.6
  const y = (v: number) => padT + plotH - ((v - min) / span) * plotH

  let body = ''
  candles.forEach((k, i) => {
    const x = padL + i * step + step / 2
    const up = k.c >= k.o
    const color = up ? '#16a34a' : '#dc2626'
    const yO = y(k.o)
    const yC = y(k.c)
    const top = Math.min(yO, yC)
    const h = Math.max(1, Math.abs(yC - yO))
    body += `<line x1="${x.toFixed(1)}" y1="${y(k.hi).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(k.lo).toFixed(1)}" stroke="${color}" stroke-width="1"/>`
    body += `<rect x="${(x - cw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${cw.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}"/>`
  })

  // 依圖種加註解，讓三張圖有辨識度
  let overlay = ''
  if (kind === 'trade') {
    const entry = y(candles[6]!.c)
    const exit = y(candles[20]!.c)
    overlay += `<line x1="${padL}" y1="${entry.toFixed(1)}" x2="${W - padR}" y2="${entry.toFixed(1)}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="5 4"/>`
    overlay += `<text x="${W - padR - 4}" y="${(entry - 4).toFixed(1)}" fill="#3b82f6" font-size="11" text-anchor="end">進場</text>`
    overlay += `<line x1="${padL}" y1="${exit.toFixed(1)}" x2="${W - padR}" y2="${exit.toFixed(1)}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="5 4"/>`
    overlay += `<text x="${W - padR - 4}" y="${(exit - 4).toFixed(1)}" fill="#f59e0b" font-size="11" text-anchor="end">出場</text>`
  } else if (kind === 'review') {
    const zx = padL + 5 * step
    const zw = 6 * step
    overlay += `<rect x="${zx.toFixed(1)}" y="${padT}" width="${zw.toFixed(1)}" height="${plotH}" fill="#14b8a6" opacity="0.12"/>`
    overlay += `<text x="${(zx + 4).toFixed(1)}" y="${(padT + 14).toFixed(1)}" fill="#14b8a6" font-size="11">關鍵區間</text>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0f172a"/>
<text x="12" y="21" fill="#94a3b8" font-size="13" font-family="monospace">${caption} · ${KIND_LABEL[kind]}</text>
${body}
${overlay}
</svg>`
}

// ── 主流程 ──────────────────────────────────────────────────
function reset() {
  fs.rmSync(join(dataDir, 'journal.db'), { force: true })
  fs.rmSync(join(dataDir, 'images'), { recursive: true, force: true })
}

function randomWlt(maxTrades: number): Wlt {
  const total = 1 + Math.floor(rand() * maxTrades)
  let w = 0
  let l = 0
  let t = 0
  for (let i = 0; i < total; i++) {
    const roll = rand()
    if (roll < 0.5) w++
    else if (roll < 0.85) l++
    else t++
  }
  return { w, l, t }
}

function run() {
  reset()
  const db = openDb(join(dataDir, 'journal.db'))
  const markets = createMarketRepo(db)
  const entries = createEntryRepo(db)
  const images = createImageRepo(db)
  const tags = createTagRepo(db)
  const rules = createRuleRepo(db)
  const store = createImageStore(dataDir)

  // 市場（歐元設為退役，示範封存狀態）
  const marketDefs = [
    { name: '台指期', archived: false },
    { name: '那斯達克', archived: false },
    { name: '黃金', archived: false },
    { name: '原油', archived: false },
    { name: '歐元', archived: true },
  ]
  const marketRows = marketDefs.map((m) => {
    const created = markets.create(m.name)
    if (m.archived) markets.setArchived(created.id, true)
    return { ...created, archived: m.archived }
  })
  const activeMarkets = marketRows.filter((m) => !m.archived)

  // 標籤
  const tagNames = ['順勢', '突破', '假突破', '追高殺低', '情緒交易', '完美執行', '提前出場', '嚴守紀律']
  tagNames.forEach((n) => tags.ensure(n))

  // 交易規則（群組 + 規則，部分帶內文與附圖）
  const groupDefs: { name: string; rules: { name: string; body?: string }[] }[] = [
    {
      name: '進場條件',
      rules: [
        { name: '只在區間邊緣進場', body: '價格觸及區間上下緣且出現反轉訊號才進場，區間中央一律不做。' },
        { name: '等待回測確認', body: '突破後等待回測不破再進，避免假突破。' },
        { name: '突破需帶量' },
      ],
    },
    {
      name: '出場條件',
      rules: [
        { name: '觸及停損立即出場', body: '停損是紀律，觸價無條件執行，不凹單。' },
        { name: '獲利先出一半' },
        { name: '時間到未達目標則平倉' },
      ],
    },
    {
      name: '心態紀律',
      rules: [
        { name: '單日虧損上限三筆', body: '單日連續虧損三筆即停止當日交易。' },
        { name: '不追高殺低' },
        { name: '情緒波動時停止交易' },
      ],
    },
  ]
  const allRules: { id: string; name: string }[] = []
  for (const g of groupDefs) {
    const group = rules.createGroup(g.name)
    for (const rDef of g.rules) {
      const rule = rules.createRule(group.id, rDef.name)
      if (rDef.body) rules.updateRule(rule.id, { bodyJson: rDef.body })
      allRules.push({ id: rule.id, name: rule.name })
    }
  }
  // 給第一條規則加一張附圖
  {
    const rule = allRules[0]!
    const svg = candlesSvg(hash('rule-' + rule.id), 'review', rule.name)
    const w = store.writeRuleImage(rule.id, Buffer.from(svg), 'svg')
    rules.addRuleImage(rule.id, w.filePath)
  }

  // 記錄：過去約 4 週的工作日 × 各活躍市場
  const start = dayjs().subtract(4, 'week').startOf('week').add(1, 'day') // 週一
  const days: string[] = []
  for (let d = start; d.isBefore(dayjs().add(1, 'day')); d = d.add(1, 'day')) {
    const dow = d.day()
    if (dow >= 1 && dow <= 5) days.push(d.format('YYYY-MM-DD'))
  }

  const putImage = (entryId: string, kind: ImageKind, caption: string) => {
    const svg = candlesSvg(hash(entryId + kind), kind, caption)
    const w = store.writeEntryImage(entryId, kind, Buffer.from(svg), 'svg')
    images.upsert(entryId, kind, w.filePath, w.width, w.height)
  }

  const notePhrases = ['執行到位。', '進場略早，可再等確認。', '出場太急，少賺一段。', '違反紀律，追高被套。', '整體節奏不錯。']

  let entryCount = 0
  let imageCount = 0
  for (const date of days) {
    for (const m of activeMarkets) {
      if (!chance(0.65)) continue
      const e = entries.upsert({ marketId: m.id, tradeDate: date })
      entryCount++
      const caption = `${m.name} ${dayjs(date).format('M/D')}`

      // 交易圖 + 實際 WLT（一定有）
      putImage(e.id, 'trade', caption)
      imageCount++
      entries.setWlt(e.id, 'actual', randomWlt(4))

      // 約 7 成完成復盤（原圖 + 復盤圖 + 理想 WLT）
      if (chance(0.7)) {
        putImage(e.id, 'raw', caption)
        putImage(e.id, 'review', caption)
        imageCount += 2
        entries.setWlt(e.id, 'ideal', randomWlt(3))
      }

      // 標籤 1~3 個
      const picked = new Set<string>()
      const tagN = 1 + Math.floor(rand() * 3)
      while (picked.size < tagN) picked.add(pick(tagNames))
      const tagIds = [...picked].map((n) => tags.ensure(n).id)
      tags.setEntryTags(e.id, tagIds)

      // 約 55% 有備註，其中部分引用規則（帶 mention）
      if (chance(0.55)) {
        const phrase = pick(notePhrases)
        let noteJson: string
        if (chance(0.6)) {
          const rule = pick(allRules)
          noteJson = JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: '今日依 ' },
                  { type: 'mention', attrs: { id: rule.id, label: rule.name } },
                  { type: 'text', text: ` 操作，${phrase}` },
                ],
              },
            ],
          })
        } else {
          noteJson = JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: phrase }] }],
          })
        }
        entries.setNote(e.id, noteJson)
        rules.setEntryRuleRefs(e.id, extractRuleIds(noteJson))
      }
    }
  }

  db.close()
  console.log(
    `✅ mock 完成：市場 ${marketRows.length}（活躍 ${activeMarkets.length}）、規則 ${allRules.length}、` +
      `記錄 ${entryCount}、圖片 ${imageCount}、標籤 ${tagNames.length}\n   資料位置：${dataDir}`,
  )
}

run()
