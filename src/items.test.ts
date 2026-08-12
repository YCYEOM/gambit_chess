import { describe, it, expect, beforeEach } from 'vitest'
import { Chess } from 'chess.js'
import { ITEMS, MAX_ON_BOARD, SPAWN_EVERY, type ItemKind, itemAt, items, maybeSpawn, pickUp, reset, restore, snapshot, take } from './items'
import * as pieces from './pieceState'

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

describe('pickUp', () => {
  beforeEach(pieces.reset)

  /** e4 에 아이템을 놓고 백 폰을 그 칸으로 보낸다. */
  function stepOnto(kind: ItemKind) {
    const game = new Chess()
    restore([['e4', kind]])
    const move = game.move('e4')
    return { game, move, picked: pickUp(game, 'e4', false) }
  }

  it('아이템이 없는 칸이면 아무 일도 없다', () => {
    const game = new Chess()
    game.move('e4')
    expect(pickUp(game, 'e4', false)).toBeNull()
  })

  it('무산된 공격은 줍지 못한다 — 도착조차 못 했다', () => {
    const game = new Chess()
    restore([['e4', 'rage']])
    game.move('e4')
    expect(pickUp(game, 'e4', true)).toBeNull()
    expect(itemAt('e4')).toBe('rage') // 그대로 남아 있다
  })

  it('분노는 그 기물의 공격력을 올린다', () => {
    stepOnto('rage')
    expect(pieces.bonus('e4').atk).toBe(ITEMS.rage.effect!.atk)
    expect(itemAt('e4')).toBeUndefined() // 주웠으니 사라진다
  })

  it('예리함은 치명타 확률을 올린다', () => {
    stepOnto('sharp')
    expect(pieces.bonus('e4').crit).toBeCloseTo(ITEMS.sharp.effect!.crit!)
  })

  it('응급처치는 체력을 만피로 되돌린다', () => {
    const game = new Chess()
    restore([['e4', 'mend']])
    const move = game.move('e4')
    pieces.applyMove(move, false, { attackerHp: 5, defenderHp: 0 }) // 다친 채로 도착
    expect(pieces.current('e4', 'p')).toBe(5)
    pickUp(game, 'e4', false)
    expect(pieces.current('e4', 'p')).toBe(pieces.maxHp('p'))
  })

  it('재행동은 차례를 둔 쪽으로 되돌린다', () => {
    const { game, picked } = stepOnto('again')
    expect(picked).toBe('again')
    expect(game.turn()).toBe('w') // 백이 뒀는데 다시 백 차례
    expect(game.moves().length).toBeGreaterThan(0)
  })

  it('재행동이 아니면 차례는 그대로 넘어간다', () => {
    const { game } = stepOnto('rage')
    expect(game.turn()).toBe('b')
  })

  it('재행동은 앙파상 권리를 지운다 — 같은 쪽이 한 번 더 두면 사라진 것이다', () => {
    const { game } = stepOnto('again')
    expect(game.fen().split(' ')[3]).toBe('-')
  })

  it('얻은 능력은 기물을 따라 움직인다', () => {
    const { game } = stepOnto('rage')
    expect(pieces.bonus('e4').atk).toBe(ITEMS.rage.effect!.atk)

    game.move('a6') // 흑
    pieces.applyMove(game.move('e5'), false, null) // 능력을 얻은 폰이 전진

    expect(pieces.bonus('e5').atk).toBe(ITEMS.rage.effect!.atk) // 따라왔다
    expect(pieces.bonus('e4').atk).toBe(0) // 떠난 자리에는 남지 않는다
  })

  it('능력을 얻은 기물이 죽으면 능력도 사라진다', () => {
    // 흑 폰이 d5 에 있어 e4 를 대각선으로 잡을 수 있다
    const game = new Chess('rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    restore([['e4', 'rage']])
    pieces.applyMove(game.move('e4'), false, null)
    pickUp(game, 'e4', false)
    expect(pieces.bonus('e4').atk).toBe(ITEMS.rage.effect!.atk)

    // 흑 폰이 e4 를 잡는다
    pieces.applyMove(game.move('dxe4'), false, { attackerHp: 9, defenderHp: 0 })
    expect(pieces.bonus('e4').atk).toBe(0) // 잡힌 기물의 능력은 남지 않는다
  })
})
