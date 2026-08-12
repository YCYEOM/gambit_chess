/**
 * 일정 수마다 빈 칸에 아이템이 나타난다. 기물이 그 칸으로 가면 효과를 얻는다.
 *
 * 아이템은 빈 칸에만 생기므로 잡는 수로는 절대 줍지 못한다 — 조용한 수로만 줍는다.
 * 그래서 "잡으러 갈까, 아이템을 주우러 갈까"가 매 수의 선택이 된다.
 *
 * 효과는 기물에 붙어 따라다니고(pieceState), 그 기물이 죽으면 함께 사라진다.
 */
import type { Chess, Square } from 'chess.js'
import { grant, maxHp, type State } from './pieceState'

export type ItemKind = 'again' | 'sharp' | 'rage' | 'mend'

export interface ItemSpec {
  name: string
  what: string
  /** 반상 위 표식 색 토큰. 값은 index.html 의 :root 한 곳에만 있다. */
  token: string
  /** 기물에 붙일 효과. mend 는 체력이라 주울 때 계산한다. */
  effect?: State
  /** 주운 쪽이 한 번 더 두는가. */
  extraTurn?: boolean
}

export const ITEMS: Record<ItemKind, ItemSpec> = {
  again: { name: '재행동', what: '즉시 한 번 더 둔다', token: '--item-again', extraTurn: true },
  sharp: { name: '예리함', what: '치명타 확률 +15%p', token: '--item-sharp', effect: { crit: 0.15 } },
  rage: { name: '분노', what: '공격력 +3', token: '--item-rage', effect: { atk: 3 } },
  mend: { name: '응급처치', what: '체력을 만피로', token: '--item-mend' },
}

const KINDS = Object.keys(ITEMS) as ItemKind[]

/** 몇 수마다 하나씩 나오는가. 너무 잦으면 반상이 아이템 쓸어담기가 된다. */
export const SPAWN_EVERY = 6
export const MAX_ON_BOARD = 2

const placed = new Map<Square, ItemKind>()

export const items = (): [Square, ItemKind][] => [...placed]
export const itemAt = (square: Square) => placed.get(square)
export const reset = () => placed.clear()

export type Snapshot = [Square, ItemKind][]
export const snapshot = (): Snapshot => [...placed]
export function restore(snap: Snapshot) {
  placed.clear()
  for (const [sq, kind] of snap) placed.set(sq, kind)
}

/** 기물도 아이템도 없는 칸. board() 는 a8 부터 행 단위로 온다. */
function freeSquares(game: Chess): Square[] {
  const out: Square[] = []
  const rows = game.board()
  for (let row = 0; row < 8; row++)
    for (let file = 0; file < 8; file++) {
      if (rows[row][file]) continue
      const square = `${'abcdefgh'[file]}${8 - row}` as Square
      if (!placed.has(square)) out.push(square)
    }
  return out
}

/**
 * 한 수가 끝날 때마다 부른다. 때가 되면 하나 놓고, 놓은 칸을 돌려준다.
 * ply 는 지금까지 둔 수의 개수다.
 */
export function maybeSpawn(game: Chess, ply: number, rng: () => number = Math.random): Square | null {
  if (ply === 0 || ply % SPAWN_EVERY !== 0) return null
  if (placed.size >= MAX_ON_BOARD) return null

  const free = freeSquares(game)
  if (free.length === 0) return null

  const square = free[Math.floor(rng() * free.length)]
  placed.set(square, KINDS[Math.floor(rng() * KINDS.length)])
  return square
}

/** 그 칸의 아이템을 집어 든다. 없으면 null. */
export function take(square: Square): ItemKind | null {
  const kind = placed.get(square)
  if (kind === undefined) return null
  placed.delete(square)
  return kind
}

/**
 * 도착 칸의 아이템을 줍고 효과를 건다. 주운 것이 없으면 null.
 *
 * 재행동은 여기서 차례까지 되돌린다 — chess.js 에 차례를 바꾸는 API 가 없어 FEN 을
 * 갈아 끼운다. 앙파상 칸은 지운다: 같은 쪽이 한 번 더 두면 그 권리는 사라진 것이다.
 * load() 가 chess.js 내부 이력을 지우므로 무르기는 FEN 스냅샷으로 해야 한다.
 */
export function pickUp(game: Chess, square: Square, repelled: boolean): ItemKind | null {
  // 아이템은 빈 칸에만 놓이므로 잡는 수로는 닿지 않고, 무산된 공격은 도착조차 못 했다.
  if (repelled) return null
  const kind = take(square)
  if (!kind) return null

  const spec = ITEMS[kind]
  if (kind === 'mend') {
    const piece = game.get(square)
    if (piece) grant(square, { hp: maxHp(piece.type) })
  } else if (spec.effect) {
    grant(square, spec.effect)
  }

  if (spec.extraTurn) {
    const [board, turn, castling, , halfmove, fullmove] = game.fen().split(' ')
    game.load([board, turn === 'w' ? 'b' : 'w', castling, '-', halfmove, fullmove].join(' '))
  }
  return kind
}
