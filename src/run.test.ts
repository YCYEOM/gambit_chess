import { describe, it, expect, beforeEach } from 'vitest'
import { Chess } from 'chess.js'
import * as run from './run'
import * as state from './pieceState'

/** node 에는 localStorage 가 없다. 해금이 최고 기록에서 파생하므로 여기서만 흉내 낸다. */
const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
}

/** 최고 기록을 원하는 값으로 만든다 (해금 상태를 세팅하는 유일한 손잡이). */
const setBest = (n: number) => store.set('gambit.best', String(n))

beforeEach(() => {
  run.ended()
  state.reset()
  store.clear()
})

describe('연승 런', () => {
  it('보상 후보는 세 장이고 서로 다르다', () => {
    const cards = run.offer()
    expect(cards).toHaveLength(3)
    expect(new Set(cards.map((c) => c.label)).size).toBe(3)
  })

  it('런이 끝나면 연승과 보상이 사라진다', () => {
    run.won()
    run.take(run.pool()[0])
    expect(run.streak()).toBe(1)
    expect(run.ended().streak).toBe(1)
    expect(run.streak()).toBe(0)
    expect(run.rewards()).toHaveLength(0)
  })

  describe('강화', () => {
    const pawnAtk = () => run.pool().find((r) => r.kind === 'atk' && r.target === 'p')!

    it('내 기물에만, 그 종류 전부에 붙는다', () => {
      const card = pawnAtk()
      run.take(card)
      const game = new Chess()
      run.applyTo(game, 'w')

      expect(state.stateOf('a2', 'p').atk).toBe(1)
      expect(state.stateOf('h2', 'p').atk).toBe(1) // 여덟 개 전부
      expect(state.stateOf('a7', 'p').atk).toBe(0) // 상대 폰은 그대로
      expect(state.stateOf('b1', 'n').atk).toBe(0) // 다른 종류도 그대로
    })

    it('같은 강화를 겹쳐 쌓으면 더해진다', () => {
      run.take(pawnAtk())
      run.take(pawnAtk())
      const game = new Chess()
      run.applyTo(game, 'w')
      expect(state.stateOf('e2', 'p').atk).toBe(2)
    })
  })

  describe('승진', () => {
    const card = (target: string, kind: 'atk' | 'crit') =>
      run.pool().find((r) => r.kind === kind && r.target === target)!

    it('승진한 기물은 새 종류의 강화를 받고 폰 몫은 내려놓는다', () => {
      run.take(card('p', 'atk')) // 폰 +1
      run.take(card('q', 'atk')) // 퀸 +3
      const game = new Chess()
      run.applyTo(game, 'w')
      expect(state.stateOf('a2', 'p').atk).toBe(1)

      run.repromote('a2', 'p', 'q') // 그 자리에서 퀸이 됐다고 치자
      expect(state.stateOf('a2', 'q').atk).toBe(3)
    })

    it('전군 강화는 승진해도 그대로 남는다', () => {
      setBest(2) // 전군 카드 해금
      const all = run.pool().find((r) => r.kind === 'atk' && r.target === 'all')!
      run.take(all)
      const game = new Chess()
      run.applyTo(game, 'w')
      run.repromote('a2', 'p', 'n')
      expect(state.stateOf('a2', 'n').atk).toBe(all.kind === 'atk' ? all.amount : 0)
    })
  })

  describe('해금', () => {
    it('처음에는 종류별 강화만 나온다', () => {
      expect(run.pool().every((r) => r.kind !== 'fuse' && r.target !== 'all')).toBe(true)
    })

    it('최고 연승이 쌓이면 전군·합성 카드가 열린다', () => {
      setBest(2)
      expect(run.pool().some((r) => r.kind !== 'fuse' && r.target === 'all')).toBe(true)
      expect(run.pool().some((r) => r.kind === 'fuse')).toBe(false)

      setBest(4)
      expect(run.pool().some((r) => r.kind === 'fuse')).toBe(true)
    })

    it('기록을 새로 세우면 그때 열린 것을 알려 준다', () => {
      for (let i = 0; i < 4; i++) run.won()
      expect(run.ended().unlocked).toEqual(['전군 강화', '합성'])
      // 같은 기록으로 다시 끝나도 또 열리지는 않는다
      for (let i = 0; i < 4; i++) run.won()
      expect(run.ended().unlocked).toEqual([])
    })
  })

  describe('합성', () => {
    const fuseCard = (from: string) => {
      setBest(4)
      return run.pool().find((r) => r.kind === 'fuse' && r.from === from)!
    }

    it('재료를 가장자리부터 없애고 그 자리에 새 기물을 세운다', () => {
      run.take(fuseCard('p'))
      const game = new Chess()
      run.applyTo(game, 'w')

      expect(game.get('h2')).toBeUndefined() // 가장자리 폰이 재료
      expect(game.get('a2')).toEqual({ type: 'n', color: 'w' }) // 그 자리에 새 기물
      expect(game.board().flat().filter((s) => s?.color === 'w' && s.type === 'p')).toHaveLength(6)
      expect(game.board().flat().filter((s) => s?.color === 'w' && s.type === 'n')).toHaveLength(3)
    })

    it('합성으로 새로 생긴 기물도 강화를 받는다', () => {
      const fuse = fuseCard('p')
      const knightAtk = run.pool().find((r) => r.kind === 'atk' && r.target === 'n')!
      run.take(knightAtk)
      run.take(fuse) // 순서와 상관없이 합성이 먼저 반영된다
      const game = new Chess()
      run.applyTo(game, 'w')
      expect(state.stateOf('a2', 'n').atk).toBe(2)
    })

    it('재료가 모자라면 카드가 나오지 않는다', () => {
      const rookToQueen = fuseCard('r')
      run.take(rookToQueen)
      expect(run.pool().some((r) => r.kind === 'fuse' && r.from === 'r')).toBe(false)
      // 룩을 다 써 버렸으니 룩 강화도 사라진다
      expect(run.pool().some((r) => r.kind !== 'fuse' && r.target === 'r')).toBe(false)
    })

    it('룩 둘을 퀸으로 합치면 캐슬링 권리가 사라진다', () => {
      run.take(fuseCard('r'))
      const game = new Chess()
      run.applyTo(game, 'w')
      expect(game.fen().split(' ')[2]).toBe('kq') // 백의 KQ 가 빠진다
    })
  })
})
