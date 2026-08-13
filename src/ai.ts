import { Chess, type Move, type PieceSymbol, type Square, type Color } from 'chess.js'
import { winChance } from './combat'
import { defenderSquareOf } from './duel'

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// 칸마다의 위치 보정 (a8 기준 8x8, 백 시점). 기물값만 보면 어느 칸이든 똑같아서
// 깊이를 아무리 늘려도 Kh1·a3 같은 무의미한 수를 둔다. 표준 simplified evaluation 값.
const PST: Partial<Record<PieceSymbol, number[]>> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  // 중반 기준 — 킹은 구석에 숨어 있어야 한다. 캐슬링을 스스로 하게 만드는 값이기도 하다.
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
}

/** 탐색이 반상에서 실제로 쓰는 것 — 내부 수 생성(아래 Engine)과 함께 쓰려고 좁혀 둔다. */
type Board = Pick<Chess, 'board' | 'turn' | 'inCheck'>
interface RawMove { piece: PieceSymbol; captured?: PieceSymbol }

/** 기물값만. 승패 판정은 부르는 쪽이 한다 (isCheckmate 는 수 생성을 또 돌려서 비싸다). */
function material(game: Board): number {
  let score = 0
  game.board().forEach((row, r) => {
    row.forEach((sq, f) => {
      if (!sq) return
      const idx = sq.color === 'w' ? r * 8 + f : (7 - r) * 8 + f
      const v = VALUE[sq.type] + (PST[sq.type]?.[idx] ?? 0)
      score += sq.color === 'w' ? v : -v
    })
  })
  return score
}

/** 항상 백(白) 기준 점수. 양수면 백이 유리. */
export function evaluate(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === 'w' ? -Infinity : Infinity
  if (game.isDraw() || game.isStalemate()) return 0
  return material(game)
}

/** 둘 수가 없는 국면의 점수 — 체크면 메이트, 아니면 스테일메이트. */
function terminal(game: Board): number {
  return game.inCheck() ? (game.turn() === 'w' ? -Infinity : Infinity) : 0
}

/**
 * 결투 모드에서 잡기는 공짜가 아니다. 탐색은 `game.move()` 로 "잡기 성공"만 두므로
 * 그 낙관을 되돌려 준다.
 *
 *   실제  = p·(수비 사망) + (1-p)·(공격자 사망)
 *   가정  = 수비 사망
 *   보정  = (1-p) × (공격자 가치 + 수비 가치)   ← 둔 쪽에게 불리하게
 *
 * 체력까지 정확히 아는 것은 뿌리(실제 반상)뿐이다. 더 깊은 수는 가상의 위치라
 * 체력 지도를 조회해도 엉뚱한 기물의 값이 나오므로 만피 기준으로만 본다.
 */
interface PieceState { hp: number; crit: number; atk: number }

function captureRisk(move: RawMove, attacker?: PieceState, defender?: PieceState): number {
  if (!move.captured) return 0
  const bonus = attacker && defender && {
    attacker: { crit: attacker.crit, atk: attacker.atk },
    defender: { crit: defender.crit, atk: defender.atk },
  }
  const p = winChance(move.piece, move.captured, attacker?.hp, defender?.hp, bonus)
  return (1 - p) * (VALUE[move.piece] + VALUE[move.captured])
}

/** 싼 기물로 비싼 기물을 잡는 수부터 본다 (MVV-LVA). 가지치기가 훨씬 잘 먹는다. */
function ordered<T extends RawMove>(moves: T[]): T[] {
  const key = (m: T) => (m.captured ? VALUE[m.captured] * 8 - VALUE[m.piece] : -1)
  return moves.sort((a, b) => key(b) - key(a))
}

/**
 * 탐색은 chess.js 의 내부 수 생성을 쓴다. 공개 `moves({verbose:true})` 는 수마다 SAN 을
 * 만드느라 27배 느리다 (0.89ms vs 0.03ms) — 그 SAN 을 탐색은 한 번도 안 본다.
 * ponytail: chess.js 1.4 의 비공개 API. 판올림 때 이 세 개만 확인하면 된다.
 * 느려도 상관없으면 moves()/move()/undo() 로 되돌릴 수 있다.
 */
type Engine = Board & {
  _moves(opts?: { legal?: boolean }): RawMove[]
  _makeMove(move: RawMove): void
  _undoMove(): void
  _history: unknown[]
}

/**
 * 깊이를 하나 올릴 때마다 시간은 서너 배가 되고, 그 배수는 국면마다 다르다.
 * 그래서 깊이만 정해 두면 어떤 국면에서 몇 초 멈출지 알 수 없다 — 시간으로 끊는다.
 * 다 못 센 회차는 통째로 버리고 직전 깊이의 답을 쓴다.
 */
const TIMEOUT = Symbol('시간 초과')
let deadline = Infinity

/**
 * 잡기 연쇄가 멎을 때까지만 더 본다. 이게 없으면 마지막 수에서 상대 퀸을 잡고 멈춰서
 * "공짜로 이겼다"고 믿는다 — 다음 수에 되잡히는 걸 못 본다. 깊이보다 이게 더 세다.
 */
function quiesce(
  game: Engine,
  alpha: number,
  beta: number,
  duelMode: boolean,
  moves = ordered(game._moves()),
): number {
  if (moves.length === 0) return terminal(game)
  const stand = material(game)

  const maximizing = game.turn() === 'w'
  // 잡지 않고 넘어갈 권리가 있으니, 가만히 있는 것보다 나쁜 잡기는 볼 필요가 없다.
  if (maximizing) { if (stand >= beta) return stand; alpha = Math.max(alpha, stand) }
  else { if (stand <= alpha) return stand; beta = Math.min(beta, stand) }

  let best = stand
  for (const m of moves) {
    if (!m.captured) break // MVV-LVA 로 정렬돼 있으니 잡는 수는 앞에 몰려 있다
    // 잡은 값을 통째로 얹어도 창을 못 넘기면 볼 필요가 없다 (델타 가지치기).
    const gain = VALUE[m.captured] + 200
    if (maximizing ? stand + gain <= alpha : stand - gain >= beta) continue

    const risk = duelMode ? captureRisk(m) : 0
    game._makeMove(m)
    const score = quiesce(game, alpha, beta, duelMode) + (maximizing ? -risk : risk)
    game._undoMove()
    if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best) }
    else { best = Math.min(best, score); beta = Math.min(beta, best) }
    if (beta <= alpha) break
  }
  return best
}

function search(game: Engine, depth: number, alpha: number, beta: number, duelMode: boolean): number {
  if (Date.now() > deadline) throw TIMEOUT
  const moves = ordered(game._moves())
  if (moves.length === 0) return terminal(game)
  if (depth === 0) return quiesce(game, alpha, beta, duelMode, moves)

  const maximizing = game.turn() === 'w'
  let best = maximizing ? -Infinity : Infinity

  for (const m of moves) {
    const risk = duelMode ? captureRisk(m) : 0
    game._makeMove(m)
    const score = search(game, depth - 1, alpha, beta, duelMode) + (maximizing ? -risk : risk)
    game._undoMove()

    if (maximizing) {
      best = Math.max(best, score)
      alpha = Math.max(alpha, score)
    } else {
      best = Math.min(best, score)
      beta = Math.min(beta, score)
    }
    if (beta <= alpha) break
  }
  return best
}

/**
 * 난이도. 깊이를 하나 올릴 때마다 시간이 서너 배가 되므로 실제로 갈리는 단계는 몇 개 안 된다 —
 * 이름만 다른 단계를 늘리지 않는다. 넣기 전에 국면 네 개로 도달 깊이를 재서 겹치면 뺐다.
 *
 * 약한 쪽은 깊이가 아니라 손떨림(noise, 센티폰)이 정한다. 얕게 봐도 실수는 안 하기 때문에
 * 깊이만 줄여서는 사람 기준의 "쉬움"이 안 나온다.
 *
 * 최강만 깊이 상한이 아니라 시간이 정한다. 끝내기·조용한 국면에서는 6~7 수까지 내려가고
 * 복잡한 중반에서는 5 에서 멈춘다 — 어차피 그 이상은 몇십 초짜리라 쓸 수 없다.
 */
export const LEVELS = [
  { label: '입문',       depth: 1, noise: 250, ms: 500 },
  { label: '쉬움',       depth: 1, noise: 90,  ms: 500 },
  { label: '보통',       depth: 2, noise: 60,  ms: 500 },
  { label: '어려움',     depth: 3, noise: 25,  ms: 1500 },
  { label: '매우 어려움', depth: 4, noise: 0,  ms: 4000 },
  { label: '최강',       depth: 8, noise: 0,  ms: 6000 },
] as const

/**
 * 뿌리의 한 수만 공개 `move()`/`undo()` 로 둔다. chess.js 는 공개 API 에서만 반복 카운터를
 * 올리고 내리기 때문에, 둔 것과 되돌리는 것의 짝이 어긋나면 유령 국면이 장부에 남는다 —
 * 그러면 실제로는 처음 나온 자리가 "세 번째"로 세어져 이기던 판이 무승부가 된다.
 *
 * 시간 초과는 탐색 한복판에서 튀어나오므로 되돌리기는 반드시 finally 에서 한다.
 * 깊은 수들은 내부 `_makeMove` 로 놓여 카운터를 건드리지 않으니 `_undoMove` 로 걷어낸다.
 */
function searchAfter(
  game: Chess, move: Move, depth: number, alpha: number, beta: number, duelMode: boolean,
): number {
  const engine = game as unknown as Engine
  const ply = engine._history.length
  game.move(move)
  try {
    return search(engine, depth, alpha, beta, duelMode)
  } finally {
    while (engine._history.length > ply + 1) engine._undoMove()
    game.undo()
  }
}

/** 뿌리에서 한 깊이를 끝까지 센다. 시간이 다 되면 TIMEOUT 을 던진다. */
function rootBest(
  game: Chess,
  moves: Move[],
  depth: number,
  noise: number,
  stateOf?: (square: Square, type: PieceSymbol) => PieceState,
): Move {
  const duelMode = stateOf !== undefined
  const maximizing = game.turn() === 'w'
  let best = moves[0]
  let bestScore = maximizing ? -Infinity : Infinity

  for (const m of moves) {
    const risk = stateOf && m.captured
      ? captureRisk(m, stateOf(m.from, m.piece), stateOf(defenderSquareOf(m), m.captured))
      : 0
    // 동점일 때 첫 수만 고집하면 매 판 똑같아진다. 노이즈가 있으면 그만큼 더 흔들린다.
    const jitter = (Math.random() - 0.5) * (1 + noise)
    // 가지치기가 잘라낸 수는 정확한 점수가 아니라 "이 선을 못 넘었다"는 경계값만 준다.
    // 그러니 흔들림까지 미리 얹은 선을 창으로 넘겨야 한다 — 안 그러면 잘린 수가 흔들림으로 뽑힌다.
    const bar = maximizing ? bestScore + risk - jitter : bestScore - risk - jitter

    const raw = searchAfter(game, m, depth - 1, maximizing ? bar : -Infinity, maximizing ? Infinity : bar, duelMode)

    const score = raw + (maximizing ? -risk : risk) + jitter
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}

/**
 * 현재 차례의 최선수. 둘 수 있는 수가 없으면 null.
 * stateOf 를 주면 결투 모드로 본다 — 잡기를 승률로 할인하고, 뿌리에서는 실제 체력까지 쓴다.
 * 그래서 다친 기물로 덤비지 않고, 다친 적을 노린다.
 * noise 는 난이도용 손떨림(센티폰), budgetMs 는 생각 시간. 깊이든 시간이든 먼저 닿는 쪽에서 멈춘다.
 */
export function bestMove(
  game: Chess,
  maxDepth = 3,
  stateOf?: (square: Square, type: PieceSymbol) => PieceState,
  noise = 0,
  budgetMs = 3000,
): Move | null {
  const moves = ordered(game.moves({ verbose: true }))
  if (moves.length === 0) return null

  let best = moves[0]

  const started = Date.now()
  deadline = started + budgetMs
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      best = rootBest(game, moves, depth, noise, stateOf)
    } catch (err) {
      if (err !== TIMEOUT) throw err
      break // 반상은 searchAfter 의 finally 가 이미 되돌려 놓았다
    }
    // 한 수 더 보는 데 서너 배가 든다. 못 끝낼 게 뻔하면 시작하지도 않는다 —
    // 어차피 버릴 회차에 남은 시간을 다 쓰면 사람만 기다린다.
    if ((Date.now() - started) * 3 > budgetMs) break
    // 다음 회차는 이 수부터 본다 — 가지치기가 훨씬 잘 먹는다.
    moves.unshift(...moves.splice(moves.indexOf(best), 1))
  }
  deadline = Infinity
  return best
}

export type { Color }
