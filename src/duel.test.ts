import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { playMove, findKing } from './duel'

/** 전투 결과를 고정한다: 0 을 계속 내면 최소 피해 + 크리티컬 없음 → 선공(공격자)이 이긴다. */
const attackerWins = () => 0
/** 공격자가 반드시 지는 rng 는 없으므로, 결과를 보고 원하는 쪽이 나올 때까지 되돌린다. */
function playUntil(game: Chess, req: Parameters<typeof playMove>[1], repelled: boolean) {
  for (let i = 0; i < 5000; i++) {
    const out = playMove(game, req)
    if (out.repelled === repelled) return out
    game.undo()
  }
  throw new Error('원하는 전투 결과가 나오지 않았다')
}

describe('playMove', () => {
  it('잡지 않는 수는 전투 없이 그대로 둔다', () => {
    const game = new Chess()
    const out = playMove(game, { from: 'e2', to: 'e4' })
    expect(out.fight).toBeNull()
    expect(out.repelled).toBe(false)
    expect(game.get('e4')?.type).toBe('p')
  })

  it('공격에 성공하면 평범한 체스와 같다', () => {
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
    const out = playMove(game, { from: 'f3', to: 'e5' }, attackerWins)
    expect(out.repelled).toBe(false)
    expect(game.get('e5')).toEqual({ type: 'n', color: 'w' })
  })

  it('공격에 실패하면 공격자가 죽고 수비 기물이 제자리에 남는다', () => {
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
    const out = playUntil(game, { from: 'f3', to: 'e5' }, true)
    expect(out.repelled).toBe(true)
    expect(game.get('e5')).toEqual({ type: 'p', color: 'b' })
    expect(game.get('f3')).toBeUndefined()
    expect(game.turn()).toBe('b') // 실패해도 턴은 넘어간다
  })

  it('앙파상 공격에 실패하면 잡힌 폰이 원래 칸으로 돌아온다', () => {
    const game = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3')
    const out = playUntil(game, { from: 'e5', to: 'f6' }, true)
    expect(out.repelled).toBe(true)
    expect(game.get('f5')).toEqual({ type: 'p', color: 'b' }) // f6 아님
    expect(game.get('f6')).toBeUndefined()
    expect(game.get('e5')).toBeUndefined()
  })

  it('실패한 수도 undo 로 완전히 되돌아간다', () => {
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
    const before = game.fen()
    playUntil(game, { from: 'f3', to: 'e5' }, true)
    game.undo()
    expect(game.fen()).toBe(before)
  })

  it('킹이 직접 공격했다가 지면 그 자리에서 패배한다', () => {
    const game = new Chess('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')
    const out = playUntil(game, { from: 'e1', to: 'e2' }, true)
    expect(out.loser).toBe('w')
    expect(findKing(game, 'w')).toBeUndefined()
  })

  it('체크를 건 기물 잡기에 실패해 킹이 노출되면 패배한다', () => {
    // 흑 룩 e2 가 백 킹 e1 을 체크. 백 룩이 잡으러 가지만 실패하면 킹이 그대로 노출된다.
    const game = new Chess('4k3/8/8/8/8/8/R3r3/4K3 w - - 0 1')
    expect(game.inCheck()).toBe(true)
    const out = playUntil(game, { from: 'a2', to: 'e2' }, true)
    expect(out.repelled).toBe(true)
    expect(out.loser).toBe('w')
    expect(game.get('e2')).toEqual({ type: 'r', color: 'b' })
  })

  it('history() 는 반상 수정을 되돌린다 — UI 가 자체 기보를 쓰는 이유', () => {
    // chess.js 의 history()/pgn() 은 초기 위치부터 수를 재생해 SAN 을 만들면서
    // 현재 반상을 덮어쓴다. 전투로 무산된 공격이 "성공"으로 되살아난다.
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
    playUntil(game, { from: 'f3', to: 'e5' }, true)
    expect(game.get('e5')).toEqual({ type: 'p', color: 'b' })

    game.history()

    expect(game.get('e5')).toEqual({ type: 'n', color: 'w' }) // 되살아났다
  })

  it('킹이 살아 있고 노출되지 않았다면 패배가 아니다', () => {
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
    const out = playUntil(game, { from: 'f3', to: 'e5' }, true)
    expect(out.loser).toBeNull()
  })
})
