// AI 끼리 결투 모드로 끝까지 둬 본다: npx vite-node scripts/simulate.ts [게임수] [깊이]
//
// 화면 없이 게임 로직만 돌린다. 아이템이 실제로 나오고 주워지는지, 재행동이 차례를
// 제대로 되돌리는지, 체력 장부가 오래 가도 어긋나지 않는지를 본다.
// 규칙 위반은 즉시 세서 보고한다 — 조용히 넘어가면 시뮬레이션의 의미가 없다.
import { Chess, type Color, type Square } from 'chess.js'
import { bestMove } from '../src/ai'
import { STATS } from '../src/combat'
import { playMove } from '../src/duel'
import * as items from '../src/items'
import * as state from '../src/pieceState'

const GAMES = Number(process.argv[2] ?? 30)
const DEPTH = Number(process.argv[3] ?? 2)
/** --blind 면 AI 가 전투 승률을 모른 채 둔다. 승률 반영의 효과를 재는 대조군. */
const BLIND = process.argv.includes('--blind')
const MAX_PLIES = 300

interface Tally {
  games: number
  plies: number[]
  results: Record<string, number>
  spawned: number
  picked: Record<items.ItemKind, number>
  extraTurns: number
  duels: number
  repelled: number
  kingFell: number
  /** 규칙이 깨진 사건. 하나라도 있으면 실패다. */
  violations: string[]
  maxItemsSeen: number
  /** 능력을 두 개 이상 가진 기물이 나온 최대치. */
  maxStacked: number
}

const tally: Tally = {
  games: 0, plies: [], results: {}, spawned: 0,
  picked: { again: 0, sharp: 0, rage: 0, mend: 0 },
  extraTurns: 0, duels: 0, repelled: 0, kingFell: 0,
  violations: [], maxItemsSeen: 0, maxStacked: 0,
}

const note = (msg: string) => {
  if (tally.violations.length < 20) tally.violations.push(msg)
}

/** 체력 장부가 반상과 어긋나지 않는지 — 죽은 기물의 기록이 남아 있으면 안 된다. */
function auditState(game: Chess, where: string) {
  const occupied = new Set<Square>()
  for (const row of game.board())
    for (const cell of row) if (cell) occupied.add(cell.square)

  for (const [square, s] of state.snapshot()) {
    if (!occupied.has(square)) {
      note(`${where}: 빈 칸 ${square} 에 상태가 남아 있다 ${JSON.stringify(s)}`)
      continue
    }
    const piece = game.get(square)!
    const max = STATS[piece.type].hp
    const hp = state.current(square, piece.type)
    if (hp < 1 || hp > max) note(`${where}: ${square} 체력 ${hp} 가 1~${max} 밖이다`)
  }
  for (const [square] of items.items()) {
    if (occupied.has(square)) note(`${where}: 기물이 선 ${square} 에 아이템이 남아 있다`)
  }
}

for (let g = 0; g < GAMES; g++) {
  const game = new Chess()
  state.reset()
  items.reset()
  let ply = 0
  let fallen: Color | null = null
  let guardExtra = 0

  while (ply < MAX_PLIES && !game.isGameOver() && !fallen) {
    const mover = game.turn()
    const move = bestMove(game, DEPTH, BLIND ? undefined : state.stateOf)
    if (!move) break

    const outcome = playMove(game, { from: move.from, to: move.to, promotion: 'q' }, Math.random, state.stateOf)
    ply++

    if (outcome.fight) {
      tally.duels++
      if (outcome.repelled) tally.repelled++
      for (const hp of [outcome.fight.attackerHp, outcome.fight.defenderHp]) {
        if (hp < 0) note(`체력이 음수다: ${hp}`)
      }
    }
    if (outcome.loser) { fallen = outcome.loser; tally.kingFell++ }

    state.applyMove(outcome.move, outcome.repelled, outcome.fight)
    state.regen(game, outcome.move.color, outcome.repelled ? undefined : outcome.move.to)

    const before = game.turn()
    const picked = items.pickUp(game, outcome.move.to, outcome.repelled)
    if (picked) {
      tally.picked[picked]++
      if (items.ITEMS[picked].extraTurn) {
        tally.extraTurns++
        if (game.turn() !== mover) note(`재행동인데 차례가 ${game.turn()} 다 (둔 쪽은 ${mover})`)
        if (game.turn() === before) note('재행동인데 차례가 안 바뀌었다')
        guardExtra++
        if (guardExtra > 40) note('재행동이 40회를 넘었다 — 무한 루프 의심')
      } else if (game.turn() !== before) {
        note(`${picked} 인데 차례가 바뀌었다`)
      }
    }

    const spawn = items.maybeSpawn(game, ply)
    if (spawn) {
      tally.spawned++
      if (game.get(spawn)) note(`아이템이 기물 위 ${spawn} 에 놓였다`)
    }
    tally.maxItemsSeen = Math.max(tally.maxItemsSeen, items.items().length)
    if (items.items().length > items.MAX_ON_BOARD) note('반상 아이템이 상한을 넘었다')

    for (const [, s] of state.snapshot()) {
      const stacked = (s.crit ? 1 : 0) + (s.atk ? 1 : 0)
      tally.maxStacked = Math.max(tally.maxStacked, stacked)
    }
    auditState(game, `${g + 1}국 ${ply}수`)
  }

  tally.games++
  tally.plies.push(ply)
  const result = fallen ? '킹 전사'
    : game.isCheckmate() ? '체크메이트'
    : game.isDraw() || game.isStalemate() ? '무승부'
    : ply >= MAX_PLIES ? '수 제한' : '기타'
  tally.results[result] = (tally.results[result] ?? 0) + 1
  process.stdout.write(`\r${g + 1}/${GAMES} 국 진행…`)
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pickedTotal = Object.values(tally.picked).reduce((a, b) => a + b, 0)

console.log(`\n\n=== ${tally.games}국, 탐색 깊이 ${DEPTH}${BLIND ? ', AI 승률 무시(대조군)' : ''} ===`)
console.log(`평균 ${avg(tally.plies).toFixed(0)}수 (최소 ${Math.min(...tally.plies)}, 최대 ${Math.max(...tally.plies)})`)
console.log(`승부:`, tally.results)
console.log(`전투 ${tally.duels}회 중 무산 ${tally.repelled}회 (${((tally.repelled / tally.duels) * 100).toFixed(0)}%), 킹 전사 ${tally.kingFell}국`)
console.log(`아이템 출현 ${tally.spawned}, 획득 ${pickedTotal} (${((pickedTotal / tally.spawned) * 100).toFixed(0)}%)`)
console.log(`  종류별:`, tally.picked)
console.log(`  재행동 발동 ${tally.extraTurns}회 | 동시 최대 ${tally.maxItemsSeen}개 | 한 기물 최대 중첩 ${tally.maxStacked}개`)
console.log(`\n규칙 위반: ${tally.violations.length === 0 ? '없음' : tally.violations.length + '건'}`)
for (const v of tally.violations) console.log(`  - ${v}`)
process.exit(tally.violations.length === 0 ? 0 : 1)
