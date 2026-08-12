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
  /** 시작 체력. 계기판이 만피가 아닌 지점에서 바를 그리려면 필요하다. */
  startHp: { attacker: number; defender: number }
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
export interface Bonus {
  /** 치명타 확률 가산. */
  crit?: number
  /** 공격력 가산. */
  atk?: number
}

export function duel(
  attacker: PieceSymbol,
  defender: PieceSymbol,
  rng: () => number = Math.random,
  start?: { attacker: number; defender: number },
  bonus?: { attacker?: Bonus; defender?: Bonus },
): Duel {
  const startHp = {
    attacker: start?.attacker ?? STATS[attacker].hp,
    defender: start?.defender ?? STATS[defender].hp,
  }
  let attackerHp = startHp.attacker
  let defenderHp = startHp.defender
  const strikes: Strike[] = []
  let by: Side = 'attacker'

  while (attackerHp > 0 && defenderHp > 0) {
    const mine = by === 'attacker' ? bonus?.attacker : bonus?.defender
    const atk = STATS[by === 'attacker' ? attacker : defender].atk + (mine?.atk ?? 0)
    const crit = rng() < CRIT_CHANCE + (mine?.crit ?? 0)
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

  return { strikes, winner: defenderHp === 0 ? 'attacker' : 'defender', attackerHp, defenderHp, startHp }
}

/**
 * 이 전투에서 공격자가 이길 확률. AI 가 "잡기는 공짜"라고 믿지 않게 하려고 쓴다.
 *
 * 닫힌 식이 없어서 그냥 굴려 본다. 체력을 2 단위로 뭉쳐 키를 만들고 결과를 기억해 두면
 * 한 번의 탐색에서 실제로 굴리는 횟수는 수십 종류 × 200 회로 끝난다.
 * 표를 손으로 관리하지 않으므로 밸런스 상수를 바꿔도 저절로 따라온다.
 */
const winCache = new Map<string, number>()
const SAMPLES = 200
const b0 = (b?: Bonus) => (b?.crit || b?.atk ? `${b.crit ?? 0},${b.atk ?? 0}` : '')

export function winChance(
  attacker: PieceSymbol,
  defender: PieceSymbol,
  attackerHp = STATS[attacker].hp,
  defenderHp = STATS[defender].hp,
  bonus?: { attacker?: Bonus; defender?: Bonus },
): number {
  const b = bonus
    ? `${b0(bonus.attacker)}|${b0(bonus.defender)}`
    : ''
  const key = `${attacker}${defender}${attackerHp >> 1}:${defenderHp >> 1}${b}`
  const cached = winCache.get(key)
  if (cached !== undefined) return cached

  let wins = 0
  for (let i = 0; i < SAMPLES; i++) {
    const d = duel(attacker, defender, Math.random, { attacker: attackerHp, defender: defenderHp }, bonus)
    if (d.winner === 'attacker') wins++
  }
  const p = wins / SAMPLES
  winCache.set(key, p)
  return p
}
