import type { PieceSymbol } from 'chess.js'

export type Side = 'attacker' | 'defender'

export interface Strike {
  by: Side
  damage: number
  crit: boolean
  /** 공격자의 첫 타격 — 기습. */
  ambush: boolean
  attackerHp: number
  defenderHp: number
}

export interface Duel {
  strikes: Strike[]
  winner: Side
  /** 전투가 끝난 시점의 체력. 다음 전투로 이어진다. */
  attackerHp: number
  defenderHp: number
}

// 20000회 시뮬레이션으로 맞춘 값. 공격자 승률(행=공격, 열=수비):
//          폰  나이트  비숍   룩   퀸   킹
//   폰     75%  38%  38%  16%   4%  11%
//   나이트  93%  77%  76%  47%  16%  33%
//   룩     99%  92%  92%  78%  40%  66%
//   퀸    100%  99%  99%  94%  78%  90%
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
 * 기습 — 움직인 쪽의 첫 타격 배수. 선공만으로는 이점이 너무 얇았다.
 * 체력이 전투 사이에 이어지면서 공격자는 상처를 안고 오고 수비자는 쉬며 회복하니,
 * 이 보정이 없으면 공격이 손해가 되고 한 자리에 눌러앉은 기물이 계속 이긴다.
 * 1.25 는 "동급 상대를 치면 유리하다"와 "가치가 높은 기물을 치면 여전히 불리하다"가
 * 동시에 성립하는 지점이다 (아래 승률표).
 */
const AMBUSH_MULT = 1.25

/**
 * 공격자가 선공한다 — 먼저 움직인 쪽의 이점이자, 잡으러 가는 행위의 보상.
 * 반환된 strikes 를 순서대로 재생하면 화면의 전투가 판정과 정확히 일치한다.
 *
 * start 를 주면 그 체력에서 시작한다. 앞선 전투에서 깎인 채로 싸우는 것이 기본이고,
 * 생략하면 만피다 (정통 모드·테스트용).
 */
export function duel(
  attacker: PieceSymbol,
  defender: PieceSymbol,
  rng: () => number = Math.random,
  start?: { attacker: number; defender: number },
): Duel {
  let attackerHp = start?.attacker ?? STATS[attacker].hp
  let defenderHp = start?.defender ?? STATS[defender].hp
  const strikes: Strike[] = []
  let by: Side = 'attacker'

  while (attackerHp > 0 && defenderHp > 0) {
    const atk = STATS[by === 'attacker' ? attacker : defender].atk
    const crit = rng() < CRIT_CHANCE
    const ambush = by === 'attacker' && strikes.length === 0
    // 최소 1 — 변동폭이 아무리 낮게 나와도 전투는 반드시 끝난다.
    const damage = Math.max(
      1,
      Math.round(
        atk * (1 - SPREAD + rng() * SPREAD * 2) * (crit ? CRIT_MULT : 1) * (ambush ? AMBUSH_MULT : 1),
      ),
    )

    if (by === 'attacker') defenderHp = Math.max(0, defenderHp - damage)
    else attackerHp = Math.max(0, attackerHp - damage)

    strikes.push({ by, damage, crit, ambush, attackerHp, defenderHp })
    by = by === 'attacker' ? 'defender' : 'attacker'
  }

  return { strikes, winner: defenderHp === 0 ? 'attacker' : 'defender', attackerHp, defenderHp }
}
