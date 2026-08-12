import { describe, it, expect, beforeEach } from 'vitest'
import { Chess } from 'chess.js'
import { ITEMS, MAX_ON_BOARD, SPAWN_EVERY, itemAt, items, maybeSpawn, reset, restore, snapshot, take } from './items'

beforeEach(reset)

/** 항상 첫 후보를 고르는 rng. */
const first = () => 0

describe('maybeSpawn', () => {
  it('정해진 수마다만 나온다', () => {
    const game = new Chess()
    for (let ply = 1; ply < SPAWN_EVERY; ply++) expect(maybeSpawn(game, ply, first)).toBeNull()
    expect(maybeSpawn(game, SPAWN_EVERY, first)).not.toBeNull()
  })

  it('0 수째에는 나오지 않는다', () => {
    expect(maybeSpawn(new Chess(), 0, first)).toBeNull()
  })

  it('빈 칸에만 놓인다', () => {
    const game = new Chess()
    const square = maybeSpawn(game, SPAWN_EVERY, first)!
    expect(game.get(square)).toBeUndefined()
  })

  it('반상 최대 개수를 넘지 않는다', () => {
    const game = new Chess()
    for (let i = 1; i <= 20; i++) maybeSpawn(game, i * SPAWN_EVERY, Math.random)
    expect(items().length).toBe(MAX_ON_BOARD)
  })

  it('이미 아이템이 있는 칸에는 겹쳐 놓지 않는다', () => {
    const game = new Chess()
    const a = maybeSpawn(game, SPAWN_EVERY, first)!
    const b = maybeSpawn(game, SPAWN_EVERY * 2, first)!
    expect(b).not.toBe(a)
  })

  it('빈 칸이 없으면 놓지 않는다', () => {
    // h1 하나만 비어 있는 반상. 첫 아이템이 그 칸을 먹으면 남는 자리가 없다.
    const packed = new Chess('rnbqkbnr/pppppppp/pppppppp/pppppppp/PPPPPPPP/PPPPPPPP/PPPPPPPP/RNBQKBN1 w - - 0 1')
    expect(maybeSpawn(packed, SPAWN_EVERY, first)).toBe('h1')
    expect(maybeSpawn(packed, SPAWN_EVERY * 2, first)).toBeNull()
  })
})

describe('take', () => {
  it('집으면 반상에서 사라진다', () => {
    const game = new Chess()
    const square = maybeSpawn(game, SPAWN_EVERY, first)!
    expect(itemAt(square)).toBeDefined()
    expect(take(square)).toBeDefined()
    expect(itemAt(square)).toBeUndefined()
    expect(take(square)).toBeNull()
  })

  it('아무것도 없는 칸이면 null', () => {
    expect(take('e4')).toBeNull()
  })
})

describe('snapshot / restore', () => {
  it('무르기용으로 되돌린다', () => {
    const game = new Chess()
    const square = maybeSpawn(game, SPAWN_EVERY, first)!
    const snap = snapshot()
    take(square)
    expect(itemAt(square)).toBeUndefined()
    restore(snap)
    expect(itemAt(square)).toBeDefined()
  })
})

describe('ITEMS', () => {
  it('재행동만 추가 턴을 준다', () => {
    expect(ITEMS.again.extraTurn).toBe(true)
    expect(Object.values(ITEMS).filter((i) => i.extraTurn)).toHaveLength(1)
  })

  it('모든 아이템에 이름·설명·색 토큰이 있다', () => {
    for (const item of Object.values(ITEMS)) {
      expect(item.name.length).toBeGreaterThan(0)
      expect(item.what.length).toBeGreaterThan(0)
      expect(item.token).toMatch(/^--/) // 색은 index.html 의 :root 에만 있다
    }
  })

  it('응급처치만 효과가 비어 있다 — 체력은 주울 때 계산한다', () => {
    expect(ITEMS.mend.effect).toBeUndefined()
    expect(ITEMS.sharp.effect?.crit).toBeGreaterThan(0)
    expect(ITEMS.rage.effect?.atk).toBeGreaterThan(0)
  })
})
