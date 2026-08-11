import { Chess, type PieceSymbol, type Square, type Color } from 'chess.js'
import { bestMove } from './ai'
import { STATS } from './combat'
import { playMove, findKing, type MoveOutcome } from './duel'
import * as board3d from './board3d'

const statusEl = document.getElementById('status')!
const movesEl = document.getElementById('moves')!
const panelEl = document.getElementById('panel')!
const duelEl = document.getElementById('duel')!
const boardEl = document.getElementById('board') as HTMLCanvasElement
const modeEl = document.getElementById('mode') as HTMLSelectElement
const sideEl = document.getElementById('side') as HTMLSelectElement
const levelEl = document.getElementById('level') as HTMLSelectElement

const game = new Chess()
let human: Color = 'w'
let selected: Square | null = null
let thinking = false
let dueling = false
/**
 * 기보는 우리가 직접 쌓는다. game.history() 는 수를 재생하면서 반상을 덮어써
 * 전투로 무산된 공격을 되살려 버린다 (duel.ts 주석 참고).
 */
let log: { san: string; from: Square; to: Square; repelled: boolean }[] = []
/** 킹이 쓰러져 즉시 끝난 경우의 패배자. */
let fallen: Color | null = null

const busy = () => thinking || dueling
const over = () => game.isGameOver() || fallen !== null

function statusText(): string {
  if (fallen) return `킹이 쓰러졌다 — ${fallen === human ? '패배' : '승리'}`
  if (game.isCheckmate()) return `체크메이트 — ${game.turn() === human ? '패배' : '승리'}`
  if (game.isDraw() || game.isStalemate()) return '무승부'
  if (dueling) return '전투 중…'
  if (thinking) return 'AI가 고민 중…'
  return `${game.turn() === 'w' ? '백' : '흑'} 차례${game.inCheck() ? ' (체크!)' : ''}`
}

/** 반상 밖(상태줄·기보·컨트롤)만 그린다. 반상 자체는 board3d 가 맡는다. */
function render() {
  const legal = selected ? game.moves({ square: selected, verbose: true }) : []
  const last = log.at(-1)
  board3d.highlight({
    selected,
    moves: legal.filter((m) => !m.captured).map((m) => m.to),
    captures: legal.filter((m) => m.captured).map((m) => m.to),
    last: last ? [last.from, last.to] : null,
    check: game.inCheck() ? findKing(game, game.turn()) ?? null : null,
  })

  statusEl.textContent = statusText()

  // AI 탐색·전투 중에는 클릭을 무시하는 것으로 끝내지 않고 실제로 잠근다.
  panelEl.querySelectorAll('button, select').forEach((el) => {
    ;(el as HTMLButtonElement | HTMLSelectElement).disabled = busy()
  })

  movesEl.replaceChildren(
    ...log.map((ply, i) => {
      const el = document.createElement('span')
      // 전투에 진 수는 기물을 잡지 못했다. SAN 은 잡은 것처럼 남으므로 표시로 구분한다.
      el.className = ply.repelled ? 'repelled' : ''
      el.textContent = `${i % 2 === 0 ? `${i / 2 + 1}. ` : ''}${ply.san}${ply.repelled ? '✗' : ''} `
      return el
    }),
  )
  movesEl.scrollTop = movesEl.scrollHeight
}

// ---------------------------------------------------------------- 전투 계기판

const duelSide = (side: 'atk' | 'def') => duelEl.querySelector(`.${side}`)!

function openDuelGauge(attacker: PieceSymbol, attackerColor: Color, defender: PieceSymbol) {
  const enemy: Color = attackerColor === 'w' ? 'b' : 'w'
  for (const [side, type, color] of [['atk', attacker, attackerColor], ['def', defender, enemy]] as const) {
    const el = duelSide(side)
    el.querySelector('.name')!.textContent = `${board3d.roleName(color, type)} · HP ${STATS[type].hp}`
    ;(el.querySelector('.bar i') as HTMLElement).style.width = '100%'
    el.querySelector('.bar i')!.classList.remove('hurt')
    el.querySelector('.dmg')!.textContent = ''
  }
  duelEl.hidden = false
}

function showStrike(struck: 'atk' | 'def', damage: number, crit: boolean, ratio: number) {
  const el = duelSide(struck)
  const dmg = el.querySelector('.dmg')!
  dmg.textContent = crit ? `${damage} 치명타!` : `${damage}`
  dmg.className = crit ? 'dmg crit' : 'dmg'
  // 클래스를 뗐다 붙여야 같은 애니메이션이 다시 재생된다.
  void (dmg as HTMLElement).offsetWidth
  dmg.classList.add('show')
  const bar = el.querySelector('.bar i') as HTMLElement
  bar.style.width = `${Math.max(0, ratio) * 100}%`
  bar.classList.toggle('hurt', ratio <= 0.3)
}

// ---------------------------------------------------------------- 수 적용

async function apply(from: Square, to: Square) {
  // ponytail: 승진은 항상 퀸. 언더프로모션이 필요하면 여기서 선택 UI를 띄운다.
  const outcome = modeEl.value === 'duel'
    ? playMove(game, { from, to, promotion: 'q' })
    : ({ move: game.move({ from, to, promotion: 'q' }), fight: null, repelled: false, loser: null } as MoveOutcome)

  // 무산 표시(✗)는 전투가 끝난 뒤에 붙인다. 먼저 넣으면 기보가 결과를 미리 알려준다.
  const ply = { san: outcome.move.san, from, to, repelled: false }
  log.push(ply)

  if (outcome.fight) {
    dueling = true
    render()
    // 전투는 반상이 갱신되기 전, 두 기물이 원래 서 있던 자리에서 벌어진다.
    // 앙파상은 잡힌 폰이 도착 칸이 아니라 그 뒤에 서 있다.
    const defenderSquare = (outcome.move.flags.includes('e')
      ? outcome.move.to[0] + outcome.move.from[1]
      : outcome.move.to) as Square
    const attackerType = outcome.move.piece
    const defenderType = outcome.move.captured as PieceSymbol

    openDuelGauge(attackerType, outcome.move.color, defenderType)
    await board3d.playDuel(
      from, defenderSquare, outcome.fight.strikes, !outcome.repelled,
      (i) => {
        const s = outcome.fight!.strikes[i]
        const struck = s.by === 'attacker' ? 'def' : 'atk'
        const max = STATS[struck === 'def' ? defenderType : attackerType].hp
        showStrike(struck, s.damage, s.crit, (struck === 'def' ? s.defenderHp : s.attackerHp) / max)
      },
    )
    duelEl.hidden = true
    dueling = false
  } else {
    await board3d.slide(from, to)
  }

  ply.repelled = outcome.repelled
  fallen = outcome.loser
  await board3d.sync(game)
  render()
}

async function onSquare(sq: Square) {
  if (busy() || over() || game.turn() !== human) return

  if (selected) {
    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === sq)
    if (move) {
      const from = selected
      selected = null
      await apply(from, sq)
      if (!over()) aiTurn()
      return
    }
  }
  selected = game.get(sq)?.color === human ? sq : null
  render()
}

function aiTurn() {
  if (over()) return
  thinking = true
  render()
  // 탐색이 UI를 막으므로 한 프레임 양보한 뒤 계산한다.
  setTimeout(async () => {
    const move = bestMove(game, Number(levelEl.value))
    thinking = false
    if (move) await apply(move.from, move.to)
    render()
  }, 20)
}

async function newGame() {
  game.reset()
  human = sideEl.value as Color
  selected = null
  thinking = false
  dueling = false
  fallen = null
  log = []
  duelEl.hidden = true
  board3d.setOrientation(human)
  await board3d.sync(game)
  render()
  if (human === 'b') aiTurn()
}

document.getElementById('new')!.onclick = () => { void newGame() }
sideEl.onchange = () => { void newGame() }
modeEl.onchange = () => { void newGame() }
document.getElementById('undo')!.onclick = async () => {
  if (busy()) return
  for (const _ of [0, 1]) {
    game.undo() // AI 수, 그리고 내 수
    log.pop()
  }
  selected = null
  fallen = null
  await board3d.sync(game)
  render()
}

board3d.init(boardEl, (sq) => { void onSquare(sq) })
addEventListener('resize', board3d.resize)
statusEl.textContent = '기물 불러오는 중…'
board3d.preload().then(newGame)
