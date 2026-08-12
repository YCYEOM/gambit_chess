import { describe, it, expect } from 'vitest'
import { Chess, type PieceSymbol, type Square } from 'chess.js'
import { bestMove, evaluate } from './ai'
import { STATS } from './combat'

describe('evaluate', () => {
  it('초기 배치는 대칭이라 0점', () => {
    expect(evaluate(new Chess())).toBe(0)
  })

  it('흑 퀸이 없으면 백이 유리', () => {
    expect(evaluate(new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))).toBeGreaterThan(800)
  })
})

describe('bestMove', () => {
  it('한 수 메이트를 찾는다 (백)', () => {
    const game = new Chess('6k1/5ppp/8/8/8/8/8/R3K2R w KQ - 0 1')
    expect(bestMove(game, 3)?.san).toBe('Ra8#')
  })

  it('공짜 퀸을 잡는다 (흑)', () => {
    const game = new Chess('rnbqkbnr/ppp1pppp/3p4/4Q3/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1')
    expect(bestMove(game, 2)?.san).toBe('dxe5')
  })

  it('탐색이 반상 상태를 훼손하지 않는다', () => {
    const game = new Chess()
    const fen = game.fen()
    bestMove(game, 3)
    expect(game.fen()).toBe(fen)
  })

  it('둘 수 있는 수가 없으면 null', () => {
    expect(bestMove(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toBeNull()
  })
})

describe('결투 모드 AI', () => {
  /** 만피 기준 체력. bestMove 에 넘기면 결투 모드로 본다. */
  const fullHp = (_sq: Square, type: PieceSymbol) => ({ hp: STATS[type].hp, crit: 0, atk: 0 })

  it('빈사 상태의 기물로는 덤비지 않는다', () => {
    // e4 의 나이트는 아무도 지키지 않는다. 만피 퀸이면 공짜지만, 퀸이 3 남았으면 자살이다.
    const fen = '7k/8/8/8/4n3/8/8/K3Q3 w - - 0 1'
    const takes = (hpOf: Parameters<typeof bestMove>[2]) => {
      let n = 0
      for (let i = 0; i < 12; i++) if (bestMove(new Chess(fen), 2, hpOf)?.to === 'e4') n++
      return n
    }
    const dying = (sq: Square, type: PieceSymbol) => ({ hp: sq === 'e1' ? 3 : STATS[type].hp, crit: 0, atk: 0 })

    expect(takes(fullHp)).toBeGreaterThan(10) // 멀쩡하면 잡는다
    expect(takes(dying)).toBeLessThan(3) // 빈사면 안 잡는다
  })

  it('다친 적을 노린다', () => {
    // 같은 나이트 둘 중 하나만 빈사. 다친 쪽을 잡으러 가야 한다.
    const fen = '4k3/8/2n1n3/3P4/8/8/8/4K3 w - - 0 1'
    const hurt = (sq: Square, type: PieceSymbol) => ({ hp: sq === 'c6' ? 3 : STATS[type].hp, crit: 0, atk: 0 })
    let atHurt = 0
    for (let i = 0; i < 12; i++) {
      if (bestMove(new Chess(fen), 2, hurt)?.to === 'c6') atHurt++
    }
    expect(atHurt).toBeGreaterThan(8)
  })

  it('체력을 안 주면 예전처럼 둔다', () => {
    const game = new Chess()
    expect(bestMove(game, 2)).not.toBeNull()
    expect(game.fen()).toBe(new Chess().fen())
  })
})
