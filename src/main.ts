import { Chess, type PieceSymbol, type Square, type Color } from 'chess.js'
import { bestMove, LEVELS } from './ai'
import { STATS } from './combat'
import * as state from './pieceState'
import * as items from './items'
import * as run from './run'
import { playMove, findKing, blockedSquares, type MoveOutcome } from './duel'
import * as board3d from './board3d'

const statusEl = document.getElementById('status')!
const movesEl = document.getElementById('moves')!
const panelEl = document.getElementById('panel')!
const duelEl = document.getElementById('duel')!
const legendEl = document.getElementById('legend')!
const boardEl = document.getElementById('board') as HTMLCanvasElement
const modeEl = document.getElementById('mode') as HTMLSelectElement
const sideEl = document.getElementById('side') as HTMLSelectElement
const levelEl = document.getElementById('level') as HTMLSelectElement
const runEl = document.getElementById('run')!
const rewardEl = document.getElementById('reward')!

const game = new Chess()
let human: Color = 'w'
let selected: Square | null = null
let thinking = false
let dueling = false
/**
 * 기보는 우리가 직접 쌓는다. game.history() 는 수를 재생하면서 반상을 덮어써
 * 전투로 무산된 공격을 되살려 버린다 (duel.ts 주석 참고).
 */
/** 무르기는 그 수를 두기 직전으로 통째로 되돌린다 — 재행동 때문에 game.undo() 로는 부족하다. */
let log: {
  san: string; from: Square; to: Square; repelled: boolean
  /** 캐슬링에서 함께 움직인 룩. 화살표를 두 개 그려야 뛰어넘은 것처럼 안 보인다. */
  rook: [Square, Square] | null
  fen: string
  pieces: state.Snapshot
  items: items.Snapshot
}[] = []
/** 킹이 쓰러져 즉시 끝난 경우의 패배자. */
let fallen: Color | null = null
/** 갈 수 없는 칸을 눌렀을 때 이유를 한 줄 붙인다. 다음 조작에서 지운다. */
let hint: string | null = null

const busy = () => thinking || dueling
const over = () => game.isGameOver() || fallen !== null

/** 왜 무승부인지. "이겼는데 무승부" 로 보이는 순간에 규칙 이름 하나는 있어야 납득이 된다. */
function drawReason(): string {
  if (game.isThreefoldRepetition()) return '같은 자리가 세 번 나왔다'
  if (game.isInsufficientMaterial()) return '남은 기물로는 이길 수 없다'
  return '50수 동안 잡지도, 폰을 옮기지도 않았다'
}

function statusText(): string {
  if (fallen) return `킹이 쓰러졌다 — ${fallen === human ? '패배' : '승리'}`
  if (game.isCheckmate()) return `체크메이트 — ${game.turn() === human ? '패배' : '승리'}`
  if (game.isStalemate()) {
    const stuck = game.turn() === human
    return `스테일메이트 · ${stuck ? '내가' : '상대가'} 둘 수가 없다 — ${stuck ? '패배' : '승리'}`
  }
  if (game.isDraw()) return `무승부 — ${drawReason()}`
  if (dueling) return '전투 중…'
  if (thinking) return 'AI가 고민 중…'
  const turn = `${game.turn() === 'w' ? '백' : '흑'} 차례${game.inCheck() ? ' (체크!)' : ''}`
  return hint ? `${turn} — ${hint}` : turn
}

/** 끝난 판의 결과. 아직 안 끝났으면 null. */
function result(): 'win' | 'loss' | 'draw' | null {
  if (fallen) return fallen === human ? 'loss' : 'win'
  if (game.isCheckmate()) return game.turn() === human ? 'loss' : 'win'
  // 스테일메이트는 몰아붙인 쪽의 승리로 친다. 체스는 무승부로 보지만 이 게임은 이미
  // 전투·아이템·킹 포획으로 규칙을 벗어나 있고, "이겼는데 무승부" 는 아케이드로 안 맞는다.
  // isDraw() 가 스테일메이트를 포함하므로 반드시 이 판정이 먼저다.
  if (game.isStalemate()) return game.turn() === human ? 'loss' : 'win'
  if (game.isDraw()) return 'draw'
  return null
}

/** 지금 이 런의 상태 — 연승·다음 상대·내가 쌓은 강화. 판이 바뀌어도 남는 것들이다. */
function runBar() {
  const duelMode = modeEl.value === 'duel'
  runEl.hidden = !duelMode
  if (!duelMode) return
  const parts = [
    `<span><b>${run.streak()}연승</b> · 최고 ${Math.max(run.best(), run.streak())}</span>`,
    ...run.rewards().map((r) => `<span class="up">${r.label}</span>`),
  ]
  runEl.innerHTML = parts.join('')
}

/** 반상 밖(상태줄·기보·컨트롤)만 그린다. 반상 자체는 board3d 가 맡는다. */
function render() {
  const legal = selected ? game.moves({ square: selected, verbose: true }) : []
  const last = log.at(-1)
  board3d.highlight({
    selected,
    moves: legal.filter((m) => !m.captured).map((m) => m.to),
    captures: legal.filter((m) => m.captured).map((m) => m.to),
    blocked: selected ? blockedSquares(game, selected) : [],
    last: last ? { from: last.from, to: last.to, repelled: last.repelled, rook: last.rook } : null,
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
  const duelMode = modeEl.value === 'duel'
  board3d.showHealth(duelMode ? state.wounded(game) : [])
  board3d.showItems(
    duelMode ? items.items().map(([square, kind]) => ({ square, token: items.ITEMS[kind].token })) : [],
  )
  if (duelMode) board3d.showBuffed(state.buffed())
  itemLegend()
  runBar()
}

/** 반상에 놓인 아이템이 뭔지 알려 준다. 색만 봐서는 효과를 모른다. */
function itemLegend() {
  const list = modeEl.value === 'duel' ? items.items() : []
  legendEl.hidden = list.length === 0
  legendEl.replaceChildren(
    ...list.map(([square, kind]) => {
      const spec = items.ITEMS[kind]
      const el = document.createElement('span')
      el.className = 'item'
      el.innerHTML = '<i></i>'
      ;(el.querySelector('i') as HTMLElement).style.background = `var(${spec.token})`
      el.append(`${square} ${spec.name} · ${spec.what}`)
      return el
    }),
  )
}

// ---------------------------------------------------------------- 전투 계기판

const duelSide = (side: 'atk' | 'def') => duelEl.querySelector(`.${side}`)!

function openDuelGauge(
  attacker: { type: PieceSymbol; color: Color; hp: number },
  defender: { type: PieceSymbol; color: Color; hp: number },
) {
  for (const [side, who] of [['atk', attacker], ['def', defender]] as const) {
    const el = duelSide(side)
    const max = STATS[who.type].hp
    el.querySelector('.name')!.textContent =
      `${board3d.roleName(who.color, who.type)} · HP ${who.hp}/${max}`
    const bar = el.querySelector('.bar i') as HTMLElement
    bar.style.width = `${(who.hp / max) * 100}%`
    bar.classList.toggle('hurt', who.hp / max <= 0.3)
    el.querySelector('.dmg')!.textContent = ''
  }
  duelEl.hidden = false
}

function showStrike(struck: 'atk' | 'def', s: { damage: number; crit: boolean; ambush: boolean }, ratio: number) {
  const el = duelSide(struck)
  const dmg = el.querySelector('.dmg')!
  const label = s.crit ? ' 치명타!' : s.ambush ? ' 기습!' : ''
  dmg.textContent = `${s.damage}${label}`
  dmg.className = s.crit || s.ambush ? 'dmg crit' : 'dmg'
  // 클래스를 뗐다 붙여야 같은 애니메이션이 다시 재생된다.
  void (dmg as HTMLElement).offsetWidth
  dmg.classList.add('show')
  const bar = el.querySelector('.bar i') as HTMLElement
  bar.style.width = `${Math.max(0, ratio) * 100}%`
  bar.classList.toggle('hurt', ratio <= 0.3)
}

// ---------------------------------------------------------------- 수 적용

/** 수를 두고 화면에 반영한다. 재행동 아이템을 먹었으면 true. */
/** 어떻게 움직이는 기물인지 한 줄. 역 이름만 보면 뭐가 퀸이고 뭐가 비숍인지 모른다. */
const HOW_IT_MOVES = {
  q: '직선과 대각선, 어디든',
  r: '직선으로만',
  b: '대각선으로만',
  n: 'ㄱ 자로, 넘어서',
} as const

/** 승진할 기물을 고르게 한다. 카드가 필요한 화면은 이미 있으니 그대로 쓴다. */
function choosePromotion(): Promise<PieceSymbol> {
  const duelMode = modeEl.value === 'duel'
  return new Promise((resolve) => {
    openReward('폰이 끝에 닿았다', '무엇으로 승진할까', (['q', 'r', 'b', 'n'] as const).map((type) => ({
      // 기물 이름이 먼저다 — 반상에서 보이는 것은 역이지만, 고르는 것은 기물이다.
      title: `${STATS[type].name} · ${board3d.roleName(human, type)}`,
      what: duelMode
        ? `${HOW_IT_MOVES[type]} · 체력 ${STATS[type].hp} · 공격력 ${STATS[type].atk}`
        : HOW_IT_MOVES[type],
      pick: () => resolve(type),
    })))
  })
}

async function apply(from: Square, to: Square, promotion: PieceSymbol = 'q'): Promise<boolean> {
  const duelMode = modeEl.value === 'duel'
  const before = { fen: game.fen(), pieces: state.snapshot(), items: items.snapshot() }
  const outcome = duelMode
    ? playMove(game, { from, to, promotion }, Math.random, state.stateOf)
    : ({ move: game.move({ from, to, promotion }), fight: null, repelled: false, loser: null } as MoveOutcome)

  // 무산 표시(✗)는 전투가 끝난 뒤에 붙인다. 먼저 넣으면 기보가 결과를 미리 알려준다.
  const ply = {
    san: outcome.move.san, from, to, repelled: false,
    rook: state.castlingRook(outcome.move), ...before,
  }
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

    const enemy: Color = outcome.move.color === 'w' ? 'b' : 'w'
    openDuelGauge(
      { type: attackerType, color: outcome.move.color, hp: outcome.fight.startHp.attacker },
      { type: defenderType, color: enemy, hp: outcome.fight.startHp.defender },
    )
    await board3d.playDuel(
      from, defenderSquare, outcome.fight.strikes, !outcome.repelled,
      (i) => {
        const s = outcome.fight!.strikes[i]
        const struck = s.by === 'attacker' ? 'def' : 'atk'
        const max = STATS[struck === 'def' ? defenderType : attackerType].hp
        showStrike(struck, s, (struck === 'def' ? s.defenderHp : s.attackerHp) / max)
      },
    )
    duelEl.hidden = true
    dueling = false
  } else {
    await board3d.slide(from, to)
  }

  ply.repelled = outcome.repelled
  fallen = outcome.loser

  let again = false
  if (duelMode) {
    state.applyMove(outcome.move, outcome.repelled, outcome.fight)
    // 승진하면 종류가 바뀐다. 런에서 쌓은 강화도 새 종류 기준으로 다시 계산한다.
    if (outcome.move.promotion && !outcome.repelled) {
      run.repromote(outcome.move.to, outcome.move.piece, outcome.move.promotion)
    }
    // 쉰 기물만 회복한다. 방금 움직인 기물은 뺀다.
    state.regen(game, outcome.move.color, outcome.repelled ? undefined : outcome.move.to)
    const picked = items.pickUp(game, outcome.move.to, outcome.repelled)
    if (picked) {
      const spec = items.ITEMS[picked]
      hint = `${spec.name} — ${spec.what}`
      again = spec.extraTurn ?? false
    }
    items.maybeSpawn(game, log.length)
  }

  await board3d.sync(game)
  render()
  if (over()) finish()
  return again
}

// ---------------------------------------------------------------- 연승 런

/**
 * 판이 끝난 순간. 이겼으면 강화 세 장을 내밀고 다음 판으로, 아니면 런이 거기서 끝난다.
 * 정통 체스는 전투가 없어 강화가 걸 곳이 없다 — 런도 돌리지 않는다.
 */
function finish() {
  if (modeEl.value !== 'duel') return
  const outcome = result()
  if (!outcome) return

  // 마지막 수가 눈에 남을 틈을 준다. 결정타 직후 화면이 덮이면 뭘 맞았는지 모른다.
  setTimeout(() => {
    if (outcome === 'win') {
      run.won()
      openReward(`승리 — ${run.streak()}연승`, '보상을 하나 고른다', run.offer().map((r) => ({
        title: r.label, what: r.what, pick: () => { run.take(r); void newRound() },
      })))
    } else if (outcome === 'draw') {
      // 무승부로 런을 끊지 않는다. 스테일메이트는 이기고 있을 때 더 잘 나서, 끊으면
      // 잘하고 있던 사람이 벌을 받는 꼴이 된다. 대신 얻는 것도 없다 — 상대도 그대로다.
      openReward(`무승부 — ${drawReason()}`, '연승은 그대로. 보상은 없다.', [{
        title: '다음 판',
        what: run.streak() ? `${run.streak()}연승 이어서` : '같은 난이도로 다시',
        pick: () => { void newRound() },
      }])
    } else {
      const { streak, unlocked } = run.ended()
      openReward(
        '패배 — 런 종료',
        `${streak}연승에서 끝났다 · 최고 ${run.best()}`
          + (unlocked.length ? ` · 새 카드 해금: ${unlocked.join(' · ')}` : ''),
        [{ title: '다시 시작', what: '연승과 보상을 처음부터', pick: () => { void newGame() } }],
      )
    }
    render()
  }, 700)
}

function openReward(head: string, sub: string, cards: { title: string; what: string; pick: () => void }[]) {
  rewardEl.querySelector('.head')!.textContent = head
  rewardEl.querySelector('.sub')!.textContent = sub
  rewardEl.querySelector('.cards')!.replaceChildren(
    ...cards.map((c) => {
      const el = document.createElement('button')
      el.className = 'card'
      el.innerHTML = '<b></b><span></span>'
      el.querySelector('b')!.textContent = c.title
      el.querySelector('span')!.textContent = c.what
      el.onclick = () => { rewardEl.hidden = true; c.pick() }
      return el
    }),
  )
  rewardEl.hidden = false
  ;(rewardEl.querySelector('.card') as HTMLButtonElement | null)?.focus()
}

async function onSquare(sq: Square) {
  if (busy() || over() || game.turn() !== human) return
  hint = null

  if (selected) {
    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === sq)
    if (move) {
      const from = selected
      selected = null
      render() // 고르는 동안 반상에 선택 표시가 남아 있지 않게
      const promotion = move.flags.includes('p') ? await choosePromotion() : undefined
      const again = await apply(from, sq, promotion)
      if (!over() && !again) aiTurn()
      return
    }
    // 형태상 갈 수 있어 보이는 칸을 눌렀다면 왜 안 되는지 말해 준다.
    if (blockedSquares(game, selected).includes(sq)) {
      hint = game.get(selected)?.type === 'k'
        ? '그 칸은 상대가 겨누고 있다'
        : game.inCheck()
          ? '지금은 체크부터 풀어야 한다'
          : '그 수를 두면 킹이 잡힌다'
      render()
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
    // 결투 모드면 상태를 넘겨 준다 — 다친 기물로 덤비지 않고 다친 적을 노린다.
    const level = LEVELS[Number(levelEl.value)]
    const move = bestMove(
      game,
      level.depth,
      modeEl.value === 'duel' ? state.stateOf : undefined,
      level.noise,
      level.ms,
    )
    thinking = false
    const again = move ? await apply(move.from, move.to, move.promotion) : false
    render()
    if (again && !over()) aiTurn() // 재행동을 먹었으면 AI 가 한 번 더 둔다
  }, 20)
}

/** 같은 런의 다음 판. 얻은 강화를 그대로 안고 시작한다. */
async function newRound() {
  await startBoard()
}

/** 런까지 처음부터. 진행 중이던 연승은 여기서 끝난 것으로 친다. */
async function newGame() {
  run.ended()
  rewardEl.hidden = true
  await startBoard()
}

async function startBoard() {
  game.reset()
  human = sideEl.value as Color
  selected = null
  thinking = false
  dueling = false
  fallen = null
  hint = null
  log = []
  state.reset()
  items.reset()
  duelEl.hidden = true
  if (modeEl.value === 'duel') run.applyTo(game, human)
  board3d.setOrientation(human)
  await board3d.sync(game)
  render()
  if (human === 'b') aiTurn()
}

document.getElementById('new')!.onclick = () => { void newGame() }
sideEl.onchange = () => { void newGame() }
modeEl.onchange = () => { void newGame() }
document.getElementById('undo')!.onclick = async () => {
  if (busy() || log.length === 0) return
  // 재행동 때문에 "두 수 되돌리기"가 항상 내 차례로 오지 않는다.
  // 마지막으로 내가 두기 직전의 상태를 찾아 통째로 되돌린다.
  let target = log.length - 1
  while (target > 0 && log[target].fen.split(' ')[1] !== human) target--
  const ply = log[target]
  log = log.slice(0, target)
  game.load(ply.fen)
  state.restore(ply.pieces)
  items.restore(ply.items)
  selected = null
  fallen = null
  await board3d.sync(game)
  render()
}

// 난이도는 ai.ts 의 LEVELS 하나만 보고 만든다 — 이름·깊이·손떨림이 갈리지 않게.
levelEl.innerHTML = LEVELS.map((l, i) => `<option value="${i}">${l.label}</option>`).join('')
levelEl.value = String(LEVELS.findIndex((l) => l.label === '어려움'))

board3d.init(boardEl, (sq) => { void onSquare(sq) })
addEventListener('resize', board3d.resize)
statusEl.textContent = '기물 불러오는 중…'
board3d.preload().then(newGame)
