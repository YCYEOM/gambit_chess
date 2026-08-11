import { Chess, type Move, type PieceSymbol, type Color } from 'chess.js'

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// 폰/나이트가 중앙으로 나오도록 하는 최소한의 위치 보정 (a8 기준 8x8, 백 시점).
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
}

/** 항상 백(白) 기준 점수. 양수면 백이 유리. */
export function evaluate(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === 'w' ? -Infinity : Infinity
  if (game.isDraw() || game.isStalemate()) return 0

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

function search(game: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || game.isGameOver()) return evaluate(game)

  const maximizing = game.turn() === 'w'
  let best = maximizing ? -Infinity : Infinity
  // 잡는 수 먼저 보면 알파-베타 가지치기가 훨씬 잘 먹는다.
  const moves = game.moves({ verbose: true }).sort((a, b) => Number(!!b.captured) - Number(!!a.captured))

  for (const m of moves) {
    game.move(m)
    const score = search(game, depth - 1, alpha, beta)
    game.undo()

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

/** 현재 차례의 최선수. 둘 수 있는 수가 없으면 null. */
export function bestMove(game: Chess, depth = 3): Move | null {
  const moves = game.moves({ verbose: true })
  if (moves.length === 0) return null

  const maximizing = game.turn() === 'w'
  let best: Move = moves[0]
  let bestScore = maximizing ? -Infinity : Infinity

  for (const m of moves) {
    game.move(m)
    // 동점일 때 첫 수만 고집하면 매 판 똑같아진다.
    const score = search(game, depth - 1, -Infinity, Infinity) + (Math.random() - 0.5)
    game.undo()
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}

export type { Color }
