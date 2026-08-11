// 전투 밸런스 표를 다시 뽑는다: npx vite-node scripts/balance.ts
// src/combat.ts 의 STATS 를 바꾸면 이걸 돌려서 그 파일 주석의 승률표를 갱신한다.
import { duel, STATS } from '../src/combat'
import type { PieceSymbol } from 'chess.js'

const TYPES: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k']
const N = 20000

console.log(`공격자 승률 (행=공격, 열=수비), ${N}회`)
console.log(' '.repeat(7) + TYPES.map((t) => STATS[t].name.padStart(7)).join(''))

for (const a of TYPES) {
  const row = TYPES.map((d) => {
    let wins = 0
    for (let i = 0; i < N; i++) if (duel(a, d).winner === 'attacker') wins++
    return `${((wins / N) * 100).toFixed(0)}%`.padStart(7)
  })
  console.log(STATS[a].name.padEnd(7) + row.join(''))
}

let strikes = 0
for (let i = 0; i < N; i++) strikes += duel('n', 'b').strikes.length
console.log(`\n평균 타격 수 (나이트 vs 비숍): ${(strikes / N).toFixed(1)}`)
