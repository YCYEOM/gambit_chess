import { describe, it, expect } from 'vitest'
import { duel, STATS } from './combat'

/** 0, 1, 0, 1... 을 돌려주는 결정적 rng — 크리티컬 없음 + 최소/최대 타격 고정. */
const cycle = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('duel', () => {
  it('공격자가 항상 선공한다', () => {
    expect(duel('p', 'q').strikes[0].by).toBe('attacker')
  })

  it('반드시 끝나고, 승자만 HP가 남는다', () => {
    for (let i = 0; i < 500; i++) {
      const { strikes, winner } = duel('n', 'r')
      const last = strikes.at(-1)!
      expect(winner === 'attacker' ? last.defenderHp : last.attackerHp).toBe(0)
      expect(winner === 'attacker' ? last.attackerHp : last.defenderHp).toBeGreaterThan(0)
    }
  })

  it('HP 기록이 누적 피해와 일치한다', () => {
    const { strikes } = duel('q', 'r')
    let attackerHp = STATS.q.hp
    let defenderHp = STATS.r.hp
    for (const s of strikes) {
      if (s.by === 'attacker') defenderHp = Math.max(0, defenderHp - s.damage)
      else attackerHp = Math.max(0, attackerHp - s.damage)
      expect([s.attackerHp, s.defenderHp]).toEqual([attackerHp, defenderHp])
    }
  })

  it('rng 가 최저값만 내도 최소 1 피해라 무한 루프에 빠지지 않는다', () => {
    // rng()=0 -> 크리티컬 없음(0 < 0.12) 이지만 변동은 최저(-50%)
    const { strikes } = duel('p', 'q', () => 0)
    expect(strikes.every((s) => s.damage >= 1)).toBe(true)
    expect(strikes.length).toBeLessThan(200)
  })

  it('크리티컬은 배수만큼 더 아프다', () => {
    const normal = duel('r', 'r', cycle(0.99, 0.5)).strikes[0] // rng()=0.99 -> 크리티컬 아님
    const crit = duel('r', 'r', cycle(0.01, 0.5)).strikes[0] // rng()=0.01 -> 크리티컬
    expect(crit.crit).toBe(true)
    expect(normal.crit).toBe(false)
    expect(crit.damage).toBeGreaterThan(normal.damage)
  })

  it('같은 기물끼리는 선공 이점으로 공격자가 유리하다', () => {
    let wins = 0
    for (let i = 0; i < 4000; i++) if (duel('n', 'n').winner === 'attacker') wins++
    expect(wins / 4000).toBeGreaterThan(0.6)
    expect(wins / 4000).toBeLessThan(0.8)
  })

  it('폰이 퀸을 이기는 일은 드물지만 불가능하지는 않다', () => {
    let wins = 0
    for (let i = 0; i < 20000; i++) if (duel('p', 'q').winner === 'attacker') wins++
    expect(wins).toBeGreaterThan(0)
    expect(wins / 20000).toBeLessThan(0.1)
  })
})
