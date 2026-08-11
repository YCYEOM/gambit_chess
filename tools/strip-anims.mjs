// KayKit 캐릭터에서 게임이 실제로 쓰는 클립만 남긴다. 원본은 76~95개인데 넷만 쓴다.
//
// 남긴 클립은 이름을 Idle / Attack_1H / Attack_2H / Hit / Death 로 통일한다. 팩마다
// 이름 규칙이 다른데(1H_Melee_Attack_Chop, Death_C_Skeletons …) 그 규칙을 런타임에도
// 두면 언젠가 어긋나고, 어긋나면 기물이 안 움직인다. 규칙은 여기 한 곳에만 둔다.
//
// 실행: node tools/strip-anims.mjs   (public/models/kaykit/*.glb 를 제자리에서 덮어쓴다)
import { NodeIO } from '@gltf-transform/core'
// 확장을 등록하지 않으면 결과가 확장 선언 없이 저장돼 모델이 깨진 채로 나온다.
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample } from '@gltf-transform/functions'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const DIR = 'public/models/kaykit'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

// 앞에 오는 규칙일수록 우선. 못 찾으면 그 다음으로 내려간다.
const WANT = {
  Idle: [/^Idle$/],
  Attack_1H: [/^1H_Melee_Attack_Chop$/, /^1H_Melee_Attack_Slice_Diagonal$/, /^1H_Melee_Attack/],
  Attack_2H: [/^2H_Melee_Attack_Chop$/, /^2H_Melee_Attack_Slice$/, /^2H_Melee_Attack/],
  Hit: [/^Hit_A$/, /^Hit_B$/, /^Hit/],
  Death: [/^Death_A$/, /^Death_C_Skeletons$/, /^Death_B$/, /^Death/],
}
const KEEP = Object.keys(WANT)

const pick = (anims, patterns) => {
  for (const re of patterns) {
    const hit = anims.find((a) => re.test(a.getName()))
    if (hit) return hit
  }
  return null
}

let before = 0
let after = 0

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.glb')).sort()) {
  const path = join(DIR, file)
  const size0 = (await stat(path)).size
  before += size0

  const doc = await io.read(path)
  const anims = doc.getRoot().listAnimations()

  // 이미 정리한 파일은 건드리지 않는다. 제자리에서 덮어쓰는 도구라 두 번 돌면
  // 이름이 이미 Idle 인 클립을 Idle 규칙으로 다시 찾다가 엉뚱한 걸 버릴 수 있다.
  if (anims.length <= KEEP.length && anims.every((a) => KEEP.includes(a.getName()))) {
    after += size0
    console.log(`${file.padEnd(22)} ${String(Math.round(size0 / 1024)).padStart(5)}KB  (이미 정리됨)`)
    continue
  }

  // 먼저 전부 고른 뒤에 이름을 바꾼다. 하나씩 바꾸면 뒤 규칙이 바뀐 이름에 걸린다.
  const chosen = new Map()
  for (const name of KEEP) {
    const clip = pick(anims, WANT[name])
    if (!clip) {
      console.warn(`  ! ${file}: ${name} 에 해당하는 클립이 없다`)
      continue
    }
    if (!chosen.has(clip)) chosen.set(clip, name)
  }
  // Animation.dispose() 는 채널·샘플러를 연쇄로 버리지 않는다. 그래서 살아남은 샘플러가
  // accessor 를 계속 붙들고, prune() 이 8500개를 못 걷어내 파일이 그대로였다.
  // 3.5MB 가 0.4MB 로 줄어드는 차이가 이 두 줄에서 난다.
  for (const a of anims) {
    if (chosen.has(a)) continue
    for (const c of a.listChannels()) c.dispose()
    for (const s of a.listSamplers()) s.dispose()
    a.dispose()
  }
  for (const [clip, name] of chosen) clip.setName(name)

  // 용량의 대부분은 메시가 아니라 애니메이션 키프레임이다. resample 이 값이 변하지 않는
  // 구간의 키를 걷어낸다 — 움직임은 그대로다.
  // weld·simplify·quantize 는 쓰지 않는다. KayKit 은 이미 저폴리이고,
  // 스킨 메시에 그런 변형을 걸면 통째로 안 보이는 사고가 난다.
  // keepLeaves 가 없으면 prune 이 handslot.r / handslot.l 을 지운다. 무기를 붙일 빈 본이라
  // 애니메이션에도 스킨에도 안 쓰여서 "쓸모없는 잎"으로 판정된다. 지우면 해골이 맨손이 된다.
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }))
  await io.write(path, doc)

  const size1 = (await stat(path)).size
  after += size1
  console.log(
    `${file.padEnd(22)} ${String(Math.round(size0 / 1024)).padStart(5)}KB → ` +
    `${String(Math.round(size1 / 1024)).padStart(5)}KB  ← ${[...chosen.values()].join(' · ')}`,
  )
}

console.log(`\n합계 ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB`)
