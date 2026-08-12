/**
 * 기물 체력을 전투 사이에 이어간다. 매 전투를 만피로 시작하면 "약해진 기물을 노린다"도
 * "물러나서 쉰다"도 성립하지 않는다.
 *
 * 체력은 칸을 키로 들고 다닌다. chess.js 가 기물에 고유 id 를 주지 않기 때문인데,
 * 대신 수를 둘 때마다 항목을 옮겨 줘야 한다 — 캐슬링(룩도 움직인다)·앙파상(잡힌 폰이
 * 도착 칸에 없다)·승진(최대 체력이 바뀐다)이 전부 여기서 걸린다.
 *
 * 지도에 없는 칸은 만피로 친다. 그래야 새 게임과 정통 모드가 아무 준비 없이 동작한다.
 */
import type { Chess, Color, Move, PieceSymbol, Square } from 'chess.js'
import { STATS } from './combat'
import { defenderSquareOf } from './duel'

/** 한 턴 쉬면 최대 체력의 이만큼 돌아온다. */
const REGEN_RATE = 0.08

const hp = new Map<Square, number>()

export const maxHp = (type: PieceSymbol) => STATS[type].hp
export const regenAmount = (type: PieceSymbol) => Math.max(1, Math.round(maxHp(type) * REGEN_RATE))

export function current(square: Square, type: PieceSymbol): number {
  return hp.get(square) ?? maxHp(type)
}

export function reset() {
  hp.clear()
}

export type Snapshot = [Square, number][]
export const snapshot = (): Snapshot => [...hp]
export function restore(snap: Snapshot) {
  hp.clear()
  for (const [sq, v] of snap) hp.set(sq, v)
}

/** 캐슬링에서 함께 움직이는 룩. chess.js 의 flags 로 어느 쪽인지 알 수 있다. */
function castlingRook(move: Move): [Square, Square] | null {
  const rank = move.color === 'w' ? '1' : '8'
  if (move.flags.includes('k')) return [`h${rank}` as Square, `f${rank}` as Square]
  if (move.flags.includes('q')) return [`a${rank}` as Square, `d${rank}` as Square]
  return null
}

/**
 * 수가 반상에 반영된 뒤 체력 장부를 맞춘다.
 * fight 가 null 이면 전투가 없었던 수(또는 정통 모드)다.
 */
export function applyMove(
  move: Move,
  repelled: boolean,
  fight: { attackerHp: number; defenderHp: number } | null,
) {
  const attackerHp = fight ? fight.attackerHp : current(move.from, move.piece)
  const defender = defenderSquareOf(move)

  hp.delete(move.from)

  if (repelled) {
    // 공격자가 죽고 수비 기물이 제자리에 남는다.
    if (fight) hp.set(defender, fight.defenderHp)
    return
  }

  hp.delete(defender)
  // 승진은 다른 기물이 된 것이다. 새 몸으로 만피에서 시작한다.
  hp.set(move.to, move.promotion ? maxHp(move.promotion) : attackerHp)

  const rook = castlingRook(move)
  if (rook) {
    const [from, to] = rook
    const value = hp.get(from)
    hp.delete(from)
    if (value !== undefined) hp.set(to, value)
  }
}

/**
 * 한 턴이 지나면 쉬고 있던 기물이 조금 회복한다.
 * 방금 움직인 기물은 제외한다 — 싸우거나 행군한 기물은 쉰 게 아니다.
 */
export function regen(game: Chess, color: Color, busy?: Square) {
  for (const row of game.board())
    for (const cell of row) {
      if (!cell || cell.color !== color || cell.square === busy) continue
      const max = maxHp(cell.type)
      const now = current(cell.square, cell.type)
      if (now < max) hp.set(cell.square, Math.min(max, now + regenAmount(cell.type)))
    }
}

/** 다친 기물만 돌려준다. 만피는 화면에 표시할 필요가 없다. */
export function wounded(game: Chess): { square: Square; ratio: number }[] {
  const out: { square: Square; ratio: number }[] = []
  for (const row of game.board())
    for (const cell of row) {
      if (!cell) continue
      const max = maxHp(cell.type)
      const now = current(cell.square, cell.type)
      if (now < max) out.push({ square: cell.square, ratio: now / max })
    }
  return out
}
