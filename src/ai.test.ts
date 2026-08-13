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

  it('깊게 봐도 공짜 퀸을 놓치지 않는다', () => {
    // 가지치기가 잘라낸 수는 정확한 점수가 아니라 경계값이라, 동점 흔들림을 그 위에 얹으면
    // 잘린 수가 최선수를 이기는 일이 생겼다. 얕은 깊이에서는 안 보이고 5수부터 터졌다.
    const game = new Chess('rnbqkbnr/ppp1pppp/3p4/4Q3/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1')
    expect(bestMove(game, 5)?.san).toBe('dxe5')
  })

  it('시간 초과로 끊겨도 반복 장부를 더럽히지 않는다', () => {
    // 뿌리의 수는 공개 move() 로 두므로 chess.js 의 반복 카운터가 올라간다. 시간 초과는
    // 탐색 한복판에서 튀어나오는데, 그때 짝을 안 맞추면 유령 국면이 장부에 쌓인다 —
    // 그러면 처음 나온 자리가 "세 번째"로 세어져 이기던 판이 무승부가 된다.
    const fen = '8/5pk1/6p1/8/3R4/5PK1/6P1/3r4 w - - 0 1'
    const game = new Chess(fen)
    const ledger = (game as unknown as { _positionCount: Map<string, number> })._positionCount
    const before = ledger.size

    for (let i = 0; i < 5; i++) bestMove(game, 8, undefined, 0, 1) // 1ms — 반드시 시간 초과

    expect(game.fen()).toBe(fen)
    expect(ledger.size).toBe(before)
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
    // 흑 룩이 e8 을 막아 백에게 체크가 없다 — 지금 안 잡으면 나이트는 도망간다.
    // (체크로 한 수 벌 수 있으면 "지금 잡기"와 "체크하고 다음에 잡기"가 같은 값이 된다.)
    const fen = '5r1k/6pp/8/8/4n3/8/8/K3Q3 w - - 0 1'
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
