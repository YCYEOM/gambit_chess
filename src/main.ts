import { Chess, type Square, type Color } from 'chess.js'
import { bestMove } from './ai'

const GLYPH: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}
const FILES = 'abcdefgh'

const boardEl = document.getElementById('board')!
const statusEl = document.getElementById('status')!
const movesEl = document.getElementById('moves')!
const sideEl = document.getElementById('side') as HTMLSelectElement
const levelEl = document.getElementById('level') as HTMLSelectElement

const game = new Chess()
let human: Color = 'w'
let selected: Square | null = null
let thinking = false

const squares: Square[] = []
for (let r = 0; r < 8; r++)
  for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${8 - r}` as Square)

function render() {
  const flip = human === 'b'
  const order = flip ? [...squares].reverse() : squares
  const legal = selected ? game.moves({ square: selected, verbose: true }) : []
  const last = game.history({ verbose: true }).at(-1)
  const checkedKing = game.inCheck()
    ? game.board().flat().find((p) => p && p.type === 'k' && p.color === game.turn())?.square
    : undefined

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

  const turnName = game.turn() === 'w' ? '백' : '흑'
  statusEl.textContent = game.isCheckmate()
    ? `체크메이트 — ${game.turn() === human ? '패배' : '승리'}`
    : game.isDraw() || game.isStalemate()
      ? '무승부'
      : thinking
        ? 'AI가 고민 중…'
        : `${turnName} 차례${game.inCheck() ? ' (체크!)' : ''}`

  movesEl.textContent = game
    .history()
    .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
    .join(' ')
  movesEl.scrollTop = movesEl.scrollHeight
}

function onClick(sq: Square) {
  if (thinking || game.isGameOver() || game.turn() !== human) return

  if (selected) {
    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === sq)
    if (move) {
      // ponytail: 승진은 항상 퀸. 언더프로모션이 필요하면 여기서 선택 UI를 띄운다.
      game.move({ from: selected, to: sq, promotion: 'q' })
      selected = null
      render()
      setTimeout(aiTurn, 120)
      return
    }
  }
  selected = game.get(sq)?.color === human ? sq : null
  render()
}

function aiTurn() {
  if (game.isGameOver()) return
  thinking = true
  render()
  // 탐색이 UI를 막으므로 한 프레임 양보한 뒤 계산한다.
  setTimeout(() => {
    const move = bestMove(game, Number(levelEl.value))
    if (move) game.move(move)
    thinking = false
    render()
  }, 20)
}

function newGame() {
  game.reset()
  human = sideEl.value as Color
  selected = null
  thinking = false
  render()
  if (human === 'b') aiTurn()
}

document.getElementById('new')!.onclick = newGame
sideEl.onchange = newGame
document.getElementById('undo')!.onclick = () => {
  if (thinking) return
  game.undo() // AI 수
  game.undo() // 내 수
  selected = null
  render()
}

newGame()
