/**
 * 연승 런 — 한 판 이기면 보상을 하나 골라 다음 판으로 이어진다. 지면 거기서 끝이고
 * 최고 연승만 남는다.
 *
 * 한 판이 단발로 끝나면 플레이 시간이 짧다. 이긴다는 것에 "내 기물이 더 세진다"는 값을
 * 붙여 판을 이어 붙인다. 상대 난이도는 사용자가 고른 그대로다 — 이기고 있는데 상대가
 * 저절로 세지면 이긴 값이 아니라 벌이 된다.
 *
 * 보상은 두 종류다.
 *  - 강화: 전투 보정(`pieceState` 의 crit·atk)을 그대로 쓴다. 아이템이 이미 쓰는 배관이라
 *    새 전투 규칙도, 새 밸런스 표도 필요 없다. 아이템은 기물 한 개에, 강화는 종류 전체에 붙는다.
 *  - 합성: 같은 기물 둘을 더 센 기물 하나로 바꾼다. 새 기물을 만들지 않고 기존 여섯 역
 *    안에서만 오간다 — 이동 규칙도 모델도 AI 평가도 그대로 쓴다.
 *
 * 해금은 저장을 늘리지 않는다. 최고 연승 하나에서 파생한다 — 잘할수록 카드가 늘어난다.
 */
import type { Chess, Color, PieceSymbol, Square } from 'chess.js'
import { grant } from './pieceState'

export interface Upgrade {
  kind: 'atk' | 'crit'
  /** 'all' 이면 전군. */
  target: PieceSymbol | 'all'
  amount: number
  label: string
  what: string
}

export interface Fusion {
  kind: 'fuse'
  from: PieceSymbol
  to: PieceSymbol
  count: number
  label: string
  what: string
}

export type Reward = Upgrade | Fusion

const NAMES: Record<PieceSymbol, string> = {
  p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹',
}

/** 처음 배치 개수. 합성이 얼마나 남았는지 세는 기준이자 강화 크기의 기준이다. */
const START: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }

/**
 * 종류 전체에 붙으므로 처음 개수가 곧 강화의 크기다. 폰 여덟에게 아이템과 같은 값을 주면
 * 폰이 퀸을 이긴다. 단일 기물(퀸·킹)일 때만 아이템(분노 +3 · 예리함 +15%p)과 같은 값이다.
 */
const SIZE: Record<PieceSymbol, { atk: number; crit: number }> = {
  p: { atk: 1, crit: 0.05 },
  n: { atk: 2, crit: 0.1 },
  b: { atk: 2, crit: 0.1 },
  r: { atk: 2, crit: 0.1 },
  q: { atk: 3, crit: 0.15 },
  k: { atk: 3, crit: 0.15 },
}

const pct = (n: number) => `${Math.round(n * 100)}%p`

function upgrade(target: PieceSymbol | 'all', kind: 'atk' | 'crit', amount: number): Upgrade {
  const who = target === 'all' ? '전군' : NAMES[target]
  const value = kind === 'atk' ? `+${amount}` : `+${pct(amount)}`
  return {
    kind, target, amount,
    label: `${who} ${kind === 'atk' ? '단련' : '급소'}`,
    what: `${target === 'all' ? '모든 기물' : `모든 ${who}`} ${kind === 'atk' ? '공격력' : '치명타'} ${value}`,
  }
}

function fusion(from: PieceSymbol, to: PieceSymbol, count: number): Fusion {
  return {
    kind: 'fuse', from, to, count,
    label: `${NAMES[from]} → ${NAMES[to]}`,
    what: `${NAMES[from]} ${count}을 ${NAMES[to]} 하나로`,
  }
}

/** 처음부터 있는 카드 — 종류별 단련·급소. */
const BASE: Reward[] = (Object.keys(SIZE) as PieceSymbol[]).flatMap((p) => [
  upgrade(p, 'atk', SIZE[p].atk),
  upgrade(p, 'crit', SIZE[p].crit),
])

/** 전군 카드. 종류를 안 가리는 대신 값이 작다 (폰 기준). */
const ARMY: Upgrade[] = [upgrade('all', 'atk', 1), upgrade('all', 'crit', 0.05)]

/** 합성 카드. 가치가 오르는 방향으로만 간다 — 룩 둘 → 퀸은 손해지만 한 기물에 몰아준다. */
const FUSE: Fusion[] = [
  fusion('p', 'n', 2),
  fusion('p', 'b', 2),
  fusion('n', 'r', 2),
  fusion('b', 'r', 2),
  fusion('r', 'q', 2),
]

/**
 * 해금 — 최고 연승이 열쇠다. 저장을 늘리지 않으려고 기록 하나에서 파생한다.
 * 로그라이크의 긴장(매번 처음부터)은 그대로 두고, 늘어나는 것은 "고를 수 있는 카드"뿐이다.
 */
export const UNLOCKS = [
  { at: 2, name: '전군 강화', cards: ARMY },
  { at: 4, name: '합성', cards: FUSE as Reward[] },
]

const CHOICES = 3

let wins = 0
let taken: Reward[] = []

export const streak = () => wins
export const rewards = () => taken as readonly Reward[]

/**
 * 최고 기록만 저장한다. 저장을 쓰는 곳은 이 두 함수뿐이다 — 해금도 여기서 파생하므로
 * 늘릴 것이 없다.
 */
const KEY = 'gambit.best'
export function best(): number {
  try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 }
}
function keepBest(n: number) {
  try { if (n > best()) localStorage.setItem(KEY, String(n)) } catch { /* 저장이 막혀도 게임은 돈다 */ }
}

/** 지금 남은 기물 수. 합성으로 줄어든 것을 반영한다. */
function counts(): Record<PieceSymbol, number> {
  const c = { ...START }
  for (const r of taken) {
    if (r.kind !== 'fuse') continue
    c[r.from] -= r.count
    c[r.to] += 1
  }
  return c
}

/** 지금 뽑을 수 있는 카드 전부 — 해금된 것 중, 실제로 쓸 수 있는 것만. */
export function pool(): Reward[] {
  const have = counts()
  const unlocked = UNLOCKS.filter((u) => best() >= u.at).flatMap((u) => u.cards)
  return [...BASE, ...unlocked].filter((r) => {
    if (r.kind === 'fuse') return have[r.from] >= r.count // 재료가 남아 있어야 한다
    return r.target === 'all' || have[r.target] > 0 // 다 합성해 없앤 종류는 강화할 것이 없다
  })
}

/** 한 판 이겼다. */
export function won() {
  wins++
}

export function take(reward: Reward) {
  taken.push(reward)
}

/**
 * 런이 끝났다(패배·무승부·새 게임). 끝난 연승과, 이번 기록으로 새로 열린 카드를 돌려준다.
 */
export function ended(): { streak: number; unlocked: string[] } {
  const before = best()
  const final = wins
  keepBest(final)
  wins = 0
  taken = []
  return {
    streak: final,
    unlocked: UNLOCKS.filter((u) => before < u.at && best() >= u.at).map((u) => u.name),
  }
}

/** 보상 후보 세 장. 이미 가진 것도 다시 나온다 — 겹쳐 쌓는 것이 빌드가 된다. */
export function offer(rng: () => number = Math.random): Reward[] {
  const left = pool()
  const out: Reward[] = []
  while (out.length < CHOICES && left.length > 0) {
    out.push(...left.splice(Math.floor(rng() * left.length), 1))
  }
  return out
}

/** 중앙에서 먼 칸일수록 크다. 합성 재료는 가장자리부터 내놓는다. */
const edge = (square: Square) => Math.abs('abcdefgh'.indexOf(square[0]) - 3.5)

function mine(game: Chess, side: Color, type: PieceSymbol): Square[] {
  const out: Square[] = []
  for (const row of game.board())
    for (const sq of row) if (sq && sq.color === side && sq.type === type) out.push(sq.square)
  return out
}

/**
 * 승진하면 몸이 바뀐다. 강화도 지금 종류를 따라가야 한다 — 폰 몫을 빼고 새 종류 몫을 얹는다.
 * 전군 강화는 어느 종류든 대상이라 그대로 두고, 아이템으로 얻은 개인 효과도 건드리지 않는다.
 */
export function repromote(square: Square, from: PieceSymbol, to: PieceSymbol) {
  for (const r of taken) {
    if (r.kind === 'fuse' || r.target === 'all') continue
    const sign = r.target === to ? 1 : r.target === from ? -1 : 0
    if (sign === 0) continue
    grant(square, r.kind === 'atk' ? { atk: sign * r.amount } : { crit: sign * r.amount })
  }
}

/**
 * 얻은 보상을 반상에 반영한다. 판을 시작한 직후 한 번 부른다.
 * 합성이 먼저다 — 기물이 바뀐 뒤에 강화를 얹어야 새 기물도 강화를 받는다.
 */
export function applyTo(game: Chess, side: Color) {
  for (const r of taken) {
    if (r.kind !== 'fuse') continue
    // 중앙 기물을 재료로 쓰면 진형이 먼저 무너진다. 바깥부터 내놓고 그 자리에 새 기물을 세운다.
    const squares = mine(game, side, r.from).sort((a, b) => edge(b) - edge(a))
    if (squares.length < r.count) continue
    const used = squares.slice(0, r.count)
    for (const sq of used) game.remove(sq)
    game.put({ type: r.to, color: side }, used[0])
  }

  for (const r of taken) {
    if (r.kind === 'fuse') continue
    const effect = r.kind === 'atk' ? { atk: r.amount } : { crit: r.amount }
    for (const row of game.board())
      for (const sq of row) {
        if (!sq || sq.color !== side) continue
        if (r.target !== 'all' && r.target !== sq.type) continue
        grant(sq.square, effect)
      }
  }
}
