import { describe, it, expect, beforeEach } from 'vitest'
import { Chess } from 'chess.js'
import { STATS } from './combat'
import { applyMove, current, regen, regenAmount, reset, restore, snapshot, wounded } from './health'

beforeEach(reset)

/** 전투 결과를 흉내 낸다 — 실제 판정은 combat.ts 가 하고 여기는 장부만 본다. */
const fight = (attackerHp: number, defenderHp: number) => ({ attackerHp, defenderHp })

/** 백 나이트가 e5 를 잡고 9 만 남긴 상태. 상처를 만드는 가장 짧은 길. */
function knightWoundedOnE5() {
  const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
  applyMove(game.move('Nxe5'), false, fight(9, 0))
  return game
}

describe('current', () => {
  it('기록이 없으면 만피다', () => {
    expect(current('e2', 'p')).toBe(STATS.p.hp)
    expect(current('d1', 'q')).toBe(STATS.q.hp)
  })
})

describe('applyMove', () => {
  it('조용한 수는 체력을 그대로 데려간다', () => {
    const game = new Chess()
    applyMove(game.move('e4'), false, null)
    expect(current('e4', 'p')).toBe(STATS.p.hp)
    expect(current('e2', 'p')).toBe(STATS.p.hp) // 떠난 자리는 기록이 없다
  })

  it('깎인 체력이 다음 칸으로 따라간다', () => {
    const game = knightWoundedOnE5()
    expect(current('e5', 'n')).toBe(9)

    game.move('d6')
    applyMove(game.move('Nf3'), false, null)
    expect(current('f3', 'n')).toBe(9) // 물러나도 상처는 그대로
    expect(current('e5', 'n')).toBe(STATS.n.hp)
  })

  it('공격에 실패하면 살아남은 수비 기물의 체력이 남는다', () => {
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1')
    applyMove(game.move('Nxe5'), true, fight(0, 6))
    expect(current('e5', 'p')).toBe(6)
    expect(current('f3', 'n')).toBe(STATS.n.hp) // 공격자는 죽었다 — 기록이 없다
  })

  it('다친 기물이 연달아 잡으면 상처가 누적된 채 따라간다', () => {
    const game = knightWoundedOnE5()
    game.move('d6')
    applyMove(game.move('Nxf7'), false, fight(4, 0))
    expect(current('f7', 'n')).toBe(4)
    expect(current('e5', 'n')).toBe(STATS.n.hp) // 떠난 자리는 비었다
  })

  it('앙파상으로 잡으면 잡힌 폰의 기록이 지워진다', () => {
    const game = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3')
    applyMove(game.move('exf6'), false, fight(11, 0))
    expect(current('f6', 'p')).toBe(11)
    expect(current('f5', 'p')).toBe(STATS.p.hp) // 잡힌 폰 자리는 비었다
  })

  it('캐슬링하면 룩의 체력도 함께 옮겨간다', () => {
    // 흑 퀸이 h1 룩을 덮쳤다가 무산돼 룩이 7 만 남았다.
    const attacked = new Chess('r3k3/8/8/8/7q/8/8/R3K2R b KQq - 0 1')
    applyMove(attacked.move('Qxh1'), true, fight(0, 7))
    expect(current('h1', 'r')).toBe(7)

    // 룩은 움직인 적이 없으니 캐슬링은 그대로 가능하다.
    const game = new Chess('r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1')
    const castle = game.move('O-O')
    expect(castle.flags).toContain('k')
    applyMove(castle, false, null)
    expect(current('f1', 'r')).toBe(7) // 룩이 f1 로 갔고 상처도 따라왔다
    expect(current('h1', 'r')).toBe(STATS.r.hp)
  })

  it('승진하면 새 몸으로 만피가 된다', () => {
    const game = new Chess('8/4P3/8/8/8/8/8/4K2k w - - 0 1')
    applyMove(game.move({ from: 'e7', to: 'e8', promotion: 'q' }), false, null)
    expect(current('e8', 'q')).toBe(STATS.q.hp)
  })
})

describe('regen', () => {
  it('쉬고 있는 기물만 회복한다', () => {
    const game = knightWoundedOnE5()

    regen(game, 'w', 'e5') // 방금 움직인 기물은 제외
    expect(current('e5', 'n')).toBe(9)

    regen(game, 'w')
    expect(current('e5', 'n')).toBe(9 + regenAmount('n'))
  })

  it('만피를 넘지 않는다', () => {
    const game = knightWoundedOnE5()
    for (let i = 0; i < 50; i++) regen(game, 'w')
    expect(current('e5', 'n')).toBe(STATS.n.hp)
  })

  it('상대 기물은 회복하지 않는다', () => {
    const game = knightWoundedOnE5()
    regen(game, 'b')
    expect(current('e5', 'n')).toBe(9)
  })
})

describe('snapshot / restore', () => {
  it('무르기용으로 장부를 되돌린다', () => {
    const game = knightWoundedOnE5()
    const snap = snapshot()

    regen(game, 'w')
    expect(current('e5', 'n')).not.toBe(9)

    restore(snap)
    expect(current('e5', 'n')).toBe(9)
  })
})

describe('wounded', () => {
  it('다친 기물만 비율과 함께 돌려준다', () => {
    const game = knightWoundedOnE5()
    const list = wounded(game)
    expect(list).toHaveLength(1)
    expect(list[0].square).toBe('e5')
    expect(list[0].ratio).toBeCloseTo(9 / STATS.n.hp)
  })
})
