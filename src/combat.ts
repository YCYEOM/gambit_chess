import type { PieceSymbol } from 'chess.js'

export type Side = 'attacker' | 'defender'

export interface Strike {
  by: Side
  damage: number
  crit: boolean
  attackerHp: number
  defenderHp: number
}

export interface Duel {
  strikes: Strike[]
  winner: Side
}

// 20000회 시뮬레이션으로 맞춘 값. 공격자 승률(행=공격, 열=수비):
//          폰  나이트  비숍   룩   퀸   킹
//   폰     67%  29%  29%  11%   2%   6%
//   나이트  91%  69%  69%  38%  12%  25%
//   룩     98%  89%  89%  71%  33%  56%
//   퀸    100%  98%  98%  91%  71%  87%
// 어떤 조합에서도 역전이 가능하되 순서는 기물 가치를 따른다.
// 값을 바꾸면 scripts/balance.ts 로 표를 다시 뽑아 이 주석을 갱신할 것.
export const STATS: Record<PieceSymbol, { hp: number; atk: number; name: string }> = {
  p: { hp: 22, atk: 7, name: '폰' },
  n: { hp: 26, atk: 9, name: '나이트' },
  b: { hp: 26, atk: 9, name: '비숍' },
  r: { hp: 30, atk: 11, name: '룩' },
  q: { hp: 36, atk: 14, name: '퀸' },
  k: { hp: 32, atk: 12, name: '킹' },
}

const SPREAD = 0.5 // 타격당 ±50% 변동
const CRIT_CHANCE = 0.12
const CRIT_MULT = 2.5

/**
 * 공격자가 선공한다 — 먼저 움직인 쪽의 이점이자, 잡으러 가는 행위의 보상.
 * 반환된 strikes 를 순서대로 재생하면 화면의 전투가 판정과 정확히 일치한다.
 */
export function duel(attacker: PieceSymbol, defender: PieceSymbol, rng: () => number = Math.random): Duel {
  let attackerHp = STATS[attacker].hp
  let defenderHp = STATS[defender].hp
  const strikes: Strike[] = []
  let by: Side = 'attacker'

  while (attackerHp > 0 && defenderHp > 0) {
    const atk = STATS[by === 'attacker' ? attacker : defender].atk
    const crit = rng() < CRIT_CHANCE
    // 최소 1 — 변동폭이 아무리 낮게 나와도 전투는 반드시 끝난다.
    const damage = Math.max(1, Math.round(atk * (1 - SPREAD + rng() * SPREAD * 2) * (crit ? CRIT_MULT : 1)))

    if (by === 'attacker') defenderHp = Math.max(0, defenderHp - damage)
    else attackerHp = Math.max(0, attackerHp - damage)

    strikes.push({ by, damage, crit, attackerHp, defenderHp })
    by = by === 'attacker' ? 'defender' : 'attacker'
  }

  return { strikes, winner: defenderHp === 0 ? 'attacker' : 'defender' }
}
