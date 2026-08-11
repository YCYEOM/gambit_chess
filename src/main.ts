import { Chess, type PieceSymbol, type Square, type Color } from 'chess.js'
import { bestMove } from './ai'
import { STATS, type Strike } from './combat'
import { playMove, findKing, type MoveOutcome } from './duel'

const GLYPH: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}
const FILES = 'abcdefgh'

const boardEl = document.getElementById('board')!
const statusEl = document.getElementById('status')!
const movesEl = document.getElementById('moves')!
const panelEl = document.getElementById('panel')!
const duelEl = document.getElementById('duel')!
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const squares: Square[] = []
for (let r = 0; r < 8; r++)
  for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${8 - r}` as Square)

function statusText(): string {
  if (fallen) return `킹이 쓰러졌다 — ${fallen === human ? '패배' : '승리'}`
  if (game.isCheckmate()) return `체크메이트 — ${game.turn() === human ? '패배' : '승리'}`
  if (game.isDraw() || game.isStalemate()) return '무승부'
  if (dueling) return '전투 중…'
  if (thinking) return 'AI가 고민 중…'
  return `${game.turn() === 'w' ? '백' : '흑'} 차례${game.inCheck() ? ' (체크!)' : ''}`
}

function render() {
  const order = human === 'b' ? [...squares].reverse() : squares
  const legal = selected ? game.moves({ square: selected, verbose: true }) : []
  const last = log.at(-1)
  const checkedKing = game.inCheck() ? findKing(game, game.turn()) : undefined

  boardEl.replaceChildren(
    ...order.map((sq) => {
      const file = FILES.indexOf(sq[0])
      const rank = 8 - Number(sq[1])
      const piece = game.get(sq)
      const move = legal.find((m) => m.to === sq)
      const el = document.createElement('div')
      el.className = [
        'sq',
        (file + rank) % 2 === 0 ? 'light' : 'dark',
        sq === selected && 'sel',
        move && 'move',
        move?.captured && 'cap',
        (sq === last?.from || sq === last?.to) && 'last',
        sq === checkedKing && 'check',
      ].filter(Boolean).join(' ')
      if (piece) {
        el.textContent = GLYPH[piece.color + piece.type]
        el.classList.add(piece.color)
      }
      el.onclick = () => onClick(sq)
      return el
    }),
  )

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

/** 전투를 화면에서 재생한다. 판정은 이미 끝났고, 여기서는 보여주기만 한다. */
async function showDuel(outcome: MoveOutcome) {
  const { move, fight } = outcome
  if (!fight) return

  const enemy: Color = move.color === 'w' ? 'b' : 'w'
  const setup = (side: 'atk' | 'def', type: PieceSymbol, color: Color) => {
    const el = duelEl.querySelector(`.${side}`)!
    el.className = `fighter ${side}`
    const glyph = el.querySelector('.glyph')!
    glyph.className = `glyph ${color}` // 반상과 같은 흑백 표기를 쓴다
    glyph.textContent = GLYPH[color + type]
    el.querySelector('.name')!.textContent = STATS[type].name
    el.querySelector('.stat')!.textContent = `HP ${STATS[type].hp} · 공격 ${STATS[type].atk}`
    ;(el.querySelector('.bar i') as HTMLElement).style.width = '100%'
    return el
  }
  const atk = setup('atk', move.piece, move.color)
  const def = setup('def', move.captured as PieceSymbol, enemy)
  const verdictEl = duelEl.querySelector('.verdict')!
  verdictEl.textContent = ''

  duelEl.hidden = false
  await sleep(450) // 마주 서는 시간

  // 타격이 많아도 전체 재생이 늘어지지 않게 간격을 줄인다.
  const step = Math.min(340, 2600 / fight.strikes.length)
  for (const s of fight.strikes) {
    const struck = s.by === 'attacker' ? def : atk
    const hp = s.by === 'attacker' ? s.defenderHp : s.attackerHp
    const max = STATS[s.by === 'attacker' ? (move.captured as PieceSymbol) : move.piece].hp
    showStrike(struck, s, hp / max)
    await sleep(step)
  }

  const [winner, loser] = fight.winner === 'attacker' ? [atk, def] : [def, atk]
  winner.classList.add('won')
  loser.classList.add('dead')
  verdictEl.textContent = outcome.repelled
    ? `${STATS[move.captured as PieceSymbol].name}이(가) 버텨냈다`
    : `${STATS[move.piece].name}이(가) 제압했다`

  await sleep(1000)
  duelEl.hidden = true
}

function showStrike(fighter: Element, s: Strike, ratio: number) {
  const dmg = fighter.querySelector('.dmg')!
  dmg.textContent = s.crit ? `${s.damage} 치명타!` : `${s.damage}`
  dmg.className = s.crit ? 'dmg crit' : 'dmg'
  const bar = fighter.querySelector('.bar i') as HTMLElement
  bar.style.width = `${ratio * 100}%`
  bar.classList.toggle('hurt', ratio <= 0.3)
  // 클래스를 뗐다 붙여야 같은 애니메이션이 다시 재생된다.
  fighter.classList.remove('hit')
  void (fighter as HTMLElement).offsetWidth
  fighter.classList.add('hit')
}

async function apply(from: Square, to: Square) {
  // ponytail: 승진은 항상 퀸. 언더프로모션이 필요하면 여기서 선택 UI를 띄운다.
  const outcome = modeEl.value === 'duel'
    ? playMove(game, { from, to, promotion: 'q' })
    : ({ move: game.move({ from, to, promotion: 'q' }), fight: null, repelled: false, loser: null } as MoveOutcome)

  log.push({ san: outcome.move.san, from, to, repelled: outcome.repelled })
  if (outcome.fight) {
    dueling = true
    render()
    await showDuel(outcome)
    dueling = false
  }
  fallen = outcome.loser
  render()
}

async function onClick(sq: Square) {
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

function newGame() {
  game.reset()
  human = sideEl.value as Color
  selected = null
  thinking = false
  dueling = false
  fallen = null
  log = []
  duelEl.hidden = true
  render()
  if (human === 'b') aiTurn()
}

document.getElementById('new')!.onclick = newGame
sideEl.onchange = newGame
modeEl.onchange = newGame
document.getElementById('undo')!.onclick = () => {
  if (busy()) return
  for (const _ of [0, 1]) {
    game.undo() // AI 수, 그리고 내 수
    log.pop()
  }
  selected = null
  fallen = null
  render()
}

newGame()
