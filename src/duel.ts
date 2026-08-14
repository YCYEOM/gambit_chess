import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import { duel, type Duel } from './combat'

const FILES = 'abcdefgh'

export interface MoveOutcome {
  move: Move
  /** 잡는 수가 아니면 null. */
  fight: Duel | null
  /** 수비 기물이 버텨서 공격자가 죽었는가. */
  repelled: boolean
  /** 전투 결과로 즉시 패배가 확정된 쪽. 없으면 null. */
  loser: Color | null
}

/** 앙파상은 잡힌 폰이 도착 칸이 아니라 그 뒤에 서 있다. */
export function defenderSquareOf(move: Move): Square {
  return (move.flags.includes('e') ? move.to[0] + move.from[1] : move.to) as Square
}

export function findKing(game: Chess, color: Color): Square | undefined {
  return game.board().flat().find((p) => p && p.type === 'k' && p.color === color)?.square
}

function neighbors(square: Square): Square[] {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1])
  const out: Square[] = []
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue
      const f = file + df
      const r = rank + dr
      if (f >= 0 && f < 8 && r >= 1 && r <= 8) out.push(`${FILES[f]}${r}` as Square)
    }
  return out
}

/**
 * 형태상 갈 수 있어 보이는데 규칙이 막는 칸. "왜 못 가는지" 를 화면에 표시하려고 쓴다.
 *
 * 킹이면 상대가 겨누고 있는 인접 칸이고, 그 외 기물이면 핀(pin)이거나 지금 체크를
 * 풀지 못하는 수다. 어느 쪽이든 이유는 하나 — 그 수를 두면 킹이 잡힌다.
 *
 * 이동 규칙을 다시 짜지 않는다. 자기 킹을 잠시 치우면 chess.js 가 체크 제약 없이
 * 수를 만들어 주므로, 거기서 합법수를 빼면 남는 것이 막힌 칸이다.
 */
export function blockedSquares(game: Chess, from: Square): Square[] {
  const piece = game.get(from)
  if (!piece || piece.color !== game.turn()) return []
  const legal = new Set(game.moves({ square: from, verbose: true }).map((m) => m.to))

  // 킹은 자기 자신을 치울 수 없으니 인접 8칸을 직접 본다.
  if (piece.type === 'k') {
    return neighbors(from).filter((sq) => game.get(sq)?.color !== piece.color && !legal.has(sq))
  }

  const probe = new Chess(game.fen())
  const king = findKing(probe, piece.color)
  if (king) probe.remove(king)
  return probe
    .moves({ square: from, verbose: true })
    .map((m) => m.to)
    // 킹을 치웠으니 킹이 서 있던 칸이 비어 보인다. 실제로는 갈 수 없는 칸이다.
    .filter((sq) => !legal.has(sq) && sq !== king)
}

/**
 * 킹은 겨눠진 칸으로도 나설 수 있다. 이 게임의 잡기는 확률이라 그 칸은 "죽는 칸" 이 아니라
 * "죽을 수도 있는 칸" 이기 때문이다 — 몰린 킹이 뚫고 나가 보는 것이 이 게임의 수다.
 *
 * chess.js 는 그런 수를 만들어 주지 않으므로 합법성 검사를 끈 내부 수 생성으로 직접 둔다.
 * ponytail: chess.js 1.4 의 비공개 API (ai.ts 와 같은 것들). 판올림 때 함께 확인한다.
 * 이 경로로 둔 수는 chess.js 의 반복 장부에 세지 않는다 — 공개 move() 만 그 장부를 만진다.
 */
interface RawMove { piece: PieceSymbol; from: number; to: number }
type Engine = {
  _moves(opts?: { legal?: boolean }): RawMove[]
  _makeMove(move: RawMove): void
}
/** 0x88 칸 번호 → 칸 이름. */
const nameOf = (index: number) => `${FILES[index & 15]}${8 - (index >> 4)}` as Square

function forceKingMove(game: Chess, from: Square, to: Square): Move | null {
  const king = game.get(from)
  if (king?.type !== 'k' || king.color !== game.turn()) return null

  const engine = game as unknown as Engine
  const raw = engine._moves({ legal: false })
    .find((m) => m.piece === 'k' && nameOf(m.from) === from && nameOf(m.to) === to)
  if (!raw) return null

  const captured = game.get(to)?.type
  engine._makeMove(raw)
  // 탐색도 기보도 쓰는 것은 몇 개뿐이라 그것만 채운 Move 를 만든다.
  return {
    color: king.color, from, to, piece: 'k', captured,
    flags: captured ? 'c' : 'n',
    san: `K${captured ? 'x' : ''}${to}`,
  } as unknown as Move
}

/** 합법수면 그대로 두고, 킹이 위험을 무릅쓴 수면 억지로 둔다. */
function makeMove(game: Chess, req: { from: Square; to: Square; promotion?: string }): Move {
  try {
    return game.move(req)
  } catch (err) {
    const forced = forceKingMove(game, req.from, req.to)
    if (!forced) throw err
    return forced
  }
}

/** 정통 모드 — 전투가 없다. 킹을 잡으면 그 자리에서 끝난다. */
export function plainMove(game: Chess, req: { from: Square; to: Square; promotion?: string }): MoveOutcome {
  const move = makeMove(game, req)
  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  return { move, fight: null, repelled: false, loser: move.captured === 'k' ? enemy : null }
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
  /** 두 기물의 현재 상태(체력·아이템 효과). 없으면 만피·보정 없음 (정통 모드·테스트). */
  stateOf?: (square: Square, type: PieceSymbol) => { hp: number; crit: number; atk: number },
): MoveOutcome {
  const move = makeMove(game, req)
  if (!move.captured) return { move, fight: null, repelled: false, loser: null }

  const mover = move.color
  const enemy: Color = mover === 'w' ? 'b' : 'w'

  const attackerState = stateOf?.(move.from, move.piece)
  const defenderState = stateOf?.(defenderSquareOf(move), move.captured)
  const start = attackerState && defenderState && {
    attacker: attackerState.hp,
    defender: defenderState.hp,
  }
  const bonus = attackerState && defenderState && {
    attacker: { crit: attackerState.crit, atk: attackerState.atk },
    defender: { crit: defenderState.crit, atk: defenderState.atk },
  }
  const fight = duel(move.piece, move.captured, rng, start, bonus)
  // 킹은 전투에서 죽어야 진다. 체크도 체크메이트도 경고일 뿐이다.
  if (fight.winner === 'attacker') {
    return { move, fight, repelled: false, loser: move.captured === 'k' ? enemy : null }
  }

  const defenderSquare = defenderSquareOf(move)
  game.remove(move.to)
  game.put({ type: move.captured, color: enemy }, defenderSquare)

  // 킹이 직접 돌격했다가 지면 거기서 끝이다 — 실제로 죽었다.
  if (move.piece === 'k') return { move, fight, repelled: true, loser: mover }

  // 노출된 것만으로는 지지 않는다. 상대가 와서 전투에 이겨야 킹이 죽는다.
  return { move, fight, repelled: true, loser: null }
}
