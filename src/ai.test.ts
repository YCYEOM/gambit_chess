import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { bestMove, evaluate } from './ai'

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
