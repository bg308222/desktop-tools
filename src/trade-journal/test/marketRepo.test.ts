import { describe, it, expect } from 'vitest'
import { openDb } from '../electron/db/connection'
import { createMarketRepo } from '../electron/db/repositories/marketRepo'

async function setup() {
  const db = await openDb(':memory:')
  return createMarketRepo(db)
}

describe('marketRepo', () => {
  it('create 依序賦予 sortOrder，list 依序回傳', async () => {
    const repo = await setup()
    const a = repo.create('台指期')
    const b = repo.create('那斯達克')
    expect(a.sortOrder).toBe(0)
    expect(b.sortOrder).toBe(1)
    expect(repo.list().map((m) => m.name)).toEqual(['台指期', '那斯達克'])
  })

  it('rename 生效', async () => {
    const repo = await setup()
    const m = repo.create('x')
    repo.rename(m.id, '黃金')
    expect(repo.list()[0].name).toBe('黃金')
  })

  it('setArchived 標記但仍保留於清單', async () => {
    const repo = await setup()
    const m = repo.create('x')
    repo.setArchived(m.id, true)
    const list = repo.list()
    expect(list).toHaveLength(1)
    expect(list[0].archived).toBe(true)
  })

  it('reorder 改變順序', async () => {
    const repo = await setup()
    const a = repo.create('a')
    const b = repo.create('b')
    repo.reorder([b.id, a.id])
    expect(repo.list().map((m) => m.name)).toEqual(['b', 'a'])
  })
})
