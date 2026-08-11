import type { Chess, Color, Move, Square } from 'chess.js'
import { duel, type Duel } from './combat'

export interface MoveOutcome {
  move: Move
  /** 잡는 수가 아니면 null. */
  fight: Duel | null
  /** 수비 기물이 버텨서 공격자가 죽었는가. */
  repelled: boolean
  /** 전투 결과로 즉시 패배가 확정된 쪽. 없으면 null. */
  loser: Color | null
}

export function findKing(game: Chess, color: Color): Square | undefined {
  return game.board().flat().find((p) => p && p.type === 'k' && p.color === color)?.square
}

/**
 * chess.js 의 합법수 판정은 그대로 두고, 잡는 수의 결과만 전투로 뒤집는다.
 * 공격이 실패하면 공격자를 지우고 수비 기물을 제자리에 되돌리므로
 * 턴·캐슬링 권리·앙파상 칸이 모두 유효한 상태로 남고 game.undo() 도 그대로 동작한다.
 *
 * 주의: 이 함수를 쓴 뒤에는 game.history() / game.pgn() 을 호출하면 안 된다.
 * 둘은 초기 위치부터 수를 다시 재생해 SAN 을 만들면서 현재 반상을 덮어쓰기 때문에
 * 여기서 한 수정이 조용히 사라진다. 기보가 필요하면 move.san 을 직접 모아 둘 것.
 * (duel.test.ts 의 "history() 는 반상 수정을 되돌린다" 테스트가 이 동작을 고정한다.)
 */
export function playMove(
  game: Chess,
  req: { from: Square; to: Square; promotion?: string },
  rng: () => number = Math.random,
): MoveOutcome {
  const move = game.move(req)
  if (!move.captured) return { move, fight: null, repelled: false, loser: null }

  const fight = duel(move.piece, move.captured, rng)
  if (fight.winner === 'attacker') return { move, fight, repelled: false, loser: null }

  const mover = move.color
  const enemy: Color = mover === 'w' ? 'b' : 'w'
  // 앙파상은 잡힌 폰이 도착 칸이 아니라 그 뒤에 서 있었다.
  const defenderSquare = (move.flags.includes('e') ? move.to[0] + move.from[1] : move.to) as Square
  game.remove(move.to)
  game.put({ type: move.captured, color: enemy }, defenderSquare)

  // 킹이 직접 돌격했다가 지면 거기서 끝이다.
  if (move.piece === 'k') return { move, fight, repelled: true, loser: mover }

  // 체크를 건 기물을 잡으러 갔다가 실패하면 킹이 무방비로 남는다.
  const king = findKing(game, mover)
  const exposed = !king || game.isAttacked(king, enemy)
  return { move, fight, repelled: true, loser: exposed ? mover : null }
}
