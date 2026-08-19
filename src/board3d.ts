/**
 * 반상과 기물을 three.js 로 그린다. 체스 규칙도, 전투 판정도 여기서 하지 않는다 —
 * main.ts 가 정한 상태를 받아 그리고, 클릭한 칸을 되돌려줄 뿐이다.
 *
 * 모델: KayKit Adventurers + Skeletons (CC0, Kay Lousberg). public/models/kaykit/CREDITS.md
 * 무료 4~5종으로 6역을 채우는 방법이 진영마다 다르다.
 * - 모험가: 무기·투구·망토가 모델 안에 별도 메시로 들어 있어 켜고 끄면 다른 기물이 된다.
 * - 해골: 무기가 별도 파일이라 handslot 본에 붙인다.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skinClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Chess, Color, PieceSymbol, Square } from 'chess.js'

const FILES = 'abcdefgh'
// GitHub Pages 프로젝트 사이트는 하위 경로에 놓인다. 절대 경로로 두면 모델을 못 찾는다.
const MODELS = `${import.meta.env.BASE_URL}models/kaykit`

interface Role {
  file: string
  name: string
  /** 모델에 내장된 장비 중 보일 것. 나머지 무기·투구·망토는 숨긴다. */
  gear?: string[]
  /** 별도 파일 무기를 손 본에 붙인다. */
  hold?: { file: string; bone: string }[]
  height: number
  /** 양손 무기를 들었으면 공격 모션도 양손으로. */
  twoHanded?: boolean
}

const WHITE: Record<PieceSymbol, Role> = {
  p: { file: 'Knight', name: '병졸', height: 0.88, gear: [] },
  n: { file: 'Rogue', name: '도적', height: 1.00, gear: ['Knife', 'Knife_Offhand', 'Rogue_Cape'] },
  b: { file: 'Rogue_Hooded', name: '두건 사수', height: 1.06, gear: ['2H_Crossbow', 'Rogue_Cape'], twoHanded: true },
  r: { file: 'Barbarian', name: '야만전사', height: 1.18, gear: ['2H_Axe', 'Barbarian_Hat', 'Barbarian_Cape'], twoHanded: true },
  q: { file: 'Mage', name: '마법사', height: 1.22, gear: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'], twoHanded: true },
  k: { file: 'Knight', name: '기사', height: 1.34, gear: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'] },
}

const BLACK: Record<PieceSymbol, Role> = {
  p: { file: 'Skeleton_Minion', name: '해골 잡졸', height: 0.88, gear: ['Skeleton_Minion_Cloak'] },
  n: {
    file: 'Skeleton_Rogue', name: '해골 도적', height: 1.00,
    gear: ['Skeleton_Rogue_Cape'], hold: [{ file: 'Skeleton_Blade', bone: 'handslot.r' }],
  },
  b: {
    file: 'Skeleton_Rogue', name: '해골 사수', height: 1.06, twoHanded: true,
    gear: ['Skeleton_Rogue_Hood', 'Skeleton_Rogue_Cape'], hold: [{ file: 'Skeleton_Crossbow', bone: 'handslot.r' }],
  },
  r: {
    file: 'Skeleton_Warrior', name: '해골 전사', height: 1.18, twoHanded: true,
    gear: ['Skeleton_Warrior_Cloak'], hold: [{ file: 'Skeleton_Axe', bone: 'handslot.r' }],
  },
  q: {
    file: 'Skeleton_Mage', name: '해골 마법사', height: 1.22, twoHanded: true,
    gear: ['Skeleton_Mage_Hat'], hold: [{ file: 'Skeleton_Staff', bone: 'handslot.r' }],
  },
  k: {
    file: 'Skeleton_Warrior', name: '해골 군주', height: 1.34,
    gear: ['Skeleton_Warrior_Helmet', 'Skeleton_Warrior_Cloak'],
    hold: [{ file: 'Skeleton_Blade', bone: 'handslot.r' }, { file: 'Skeleton_Shield_Large_A', bone: 'handslot.l' }],
  },
}

const ARMY: Record<Color, Record<PieceSymbol, Role>> = { w: WHITE, b: BLACK }

export const roleName = (color: Color, type: PieceSymbol) => ARMY[color][type].name

// ---------------------------------------------------------------- 좌표

/** a8 이 (-3.5, -3.5), h1 이 (3.5, 3.5). 2D 판의 배열 순서와 같다. */
function squareToWorld(sq: Square) {
  return { x: FILES.indexOf(sq[0]) - 3.5, z: 8 - Number(sq[1]) - 3.5 }
}

function worldToSquare(x: number, z: number): Square | null {
  const file = Math.round(x + 3.5)
  const row = Math.round(z + 3.5)
  if (file < 0 || file > 7 || row < 0 || row > 7) return null
  return `${FILES[file]}${8 - row}` as Square
}

// ---------------------------------------------------------------- 씬

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let canvasEl: HTMLCanvasElement
let flipped = false
/** 결투 중에는 카메라가 반상을 벗어나 있으므로 기본 시점으로 되돌리지 않는다. */
let cameraLocked = false

const markers = new THREE.Group()
const healthBars = new THREE.Group()
const itemGroup = new THREE.Group()
const fxGroup = new THREE.Group()
const clock = new THREE.Clock()
let spin = 0

const token = (name: string) =>
  new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

/**
 * token() 이 돌려주는 THREE.Color 는 **선형** 공간이다. three 가 재질 색을 그렇게 받기
 * 때문인데, 캔버스에 붓으로 칠할 값은 sRGB 라 되돌려 놓아야 한다. 그냥 .r 을 쓰면 어두운
 * 색일수록 크게 어긋난다 — #211d1a (sRGB 0.129) 가 캔버스에서는 0.015 가 되어 거의
 * 순검정으로 칠해진다.
 */
function srgbOf(c: THREE.Color) {
  const h = c.getHexString()
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  }
}

export function init(canvas: HTMLCanvasElement, onPick: (sq: Square) => void) {
  canvasEl = canvas
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  scene = new THREE.Scene()
  scene.background = token('--bg')
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x33302c, 1.7))
  const key = new THREE.DirectionalLight(0xfff2dd, 2.3)
  key.position.set(-4, 8, 5)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  const d = 7
  Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 30 })
  scene.add(key)
  // Object3D.position 은 읽기 전용 접근자라 대입이 아니라 set() 으로 넣어야 한다.
  const fill = new THREE.DirectionalLight(0x9fb4d8, 0.6)
  fill.position.set(5, 4, -6)
  scene.add(fill)

  buildBoard()
  buildGround()
  scene.add(markers, healthBars, itemGroup, fxGroup)

  canvas.addEventListener('pointerdown', (e) => {
    const sq = pick(e)
    if (sq) onPick(sq)
  })

  /**
   * 누를 때마다 반상이 통째로 파랗게 덮이는 일이 있었다 (안드로이드). 캔버스가 선택되거나
   * 탭 하이라이트가 씌워진 것인데, CSS 로 껐어도 브라우저에 따라 남는다.
   * 칸은 pointerdown 에서 이미 집었으므로 터치의 기본 동작은 버려도 잃을 것이 없다.
   */
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
  for (const type of ['selectstart', 'contextmenu', 'dragstart']) {
    canvas.addEventListener(type, (e) => e.preventDefault())
  }

  resetCamera()
  resize()
  renderer.setAnimationLoop(tick)
}

/**
 * 반상 — 나무 체스판 사진 한 장을 img2threejs 로 재구성한 것.
 * 스펙: scratchpad/board-recon/object-sculpt-spec.json (strict-quality PASS)
 *
 * 레퍼런스에서 가져온 정체성 넷:
 *  1. 나무-대-나무 저대비 칸 (흑백이 아니다)
 *  2. 45도로 맞물린 넓은 연귀 테두리 — 결이 각 변을 따라 흐른다
 *  3. 두꺼운 슬랩. 판이 얇은 종이가 아니라 상자로 읽힌다
 *  4. 모서리 스플라인 홈 — 옆면 구석마다 가는 줄 셋
 *
 * 일부러 뺀 것: 접이식 경첩 이음매. 우리 반상은 한 장이고, 그 줄이 a~h 파일을 가로지르면
 * 판이 갈라진 렌더링 사고로 보인다.
 *
 * 색은 여기서 정하지 않는다 — index.html 의 :root 가 색의 단일 원천이다 (DESIGN.md).
 */
const BOARD = {
  rail: 0.62,      // 테두리 폭. 레퍼런스는 0.11W 였지만 그대로 두면 판이 10.26 칸이 되어
                   // 카메라가 물러나고 반상이 화면에서 18% 작아진다 — 0.067W 로 줄였다.
  thick: 0.62,     // 슬랩 두께 (레퍼런스 0.075W → 0.067W)
  tile: 0.16,      // 칸 두께. 윗면은 반드시 y=0 이다 (pick 이 그 평면에서 칸을 집는다)
  chamferW: 0.10,  // 바깥 윗모서리 모따기 폭
  chamferD: 0.06,  // 모따기 낙차
}
/** 반상 바깥 반폭. 카메라 시야 계산(HALF)이 이 값을 따라간다. */
const BOARD_HALF = 4 + BOARD.rail

/** 씨 고정 난수. 결 무늬가 새로고침마다 달라지면 같은 판이 아니다. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 결 판재 한 장. 세 나무 재질이 같은 캔버스를 나눠 쓴다 — 색과 UV 회전만 다르다.
 * 내려받는 것이 없고 GPU 에는 텍스처 하나만 올라간다.
 */
function grainCanvas(size: number, seed: number, base: string, ink: string, lines: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  const r = seeded(seed)
  g.lineCap = 'round'
  for (let i = 0; i < lines; i++) {
    const x = r() * size
    const w = 0.4 + r() * 2.2
    g.strokeStyle = ink
    g.globalAlpha = 0.02 + r() * 0.05
    g.lineWidth = w
    g.beginPath()
    g.moveTo(x, -8)
    // 결은 곧지 않다 — 세 마디로 흔들어야 자국이 아니라 나무로 읽힌다.
    for (let y = 0; y <= size; y += size / 3) g.lineTo(x + (r() - 0.5) * 9, y)
    g.stroke()
  }
  g.globalAlpha = 1
  return c
}

/** 네 변이 45도로 맞물린 띠 한 겹. 안쪽 반폭에서 바깥 반폭으로, y0 에서 y1 로 내려간다. */
function mitredRing(inner: number, outer: number, y0: number, y1: number, uScale: number) {
  const pos: number[] = []
  const uv: number[] = []
  // +z, +x, -z, -x 순서. 각 변의 u 는 그 변의 길이 방향이라, 이웃한 변끼리 결이 90도 엇갈린다.
  const sides: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  for (const [sx, sz] of sides) {
    // 변의 법선 방향이 (sx,sz). 길이 방향은 그것을 90도 돌린 것.
    const tx = -sz
    const tz = sx
    const p = (h: number, t: number, y: number) => [sx * h + tx * t, y, sz * h + tz * t]
    const a = p(inner, -inner, y0)
    const b = p(inner, inner, y0)
    const c = p(outer, outer, y1)
    const d = p(outer, -outer, y1)
    pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    // u 는 길이 방향, v 는 띠를 가로지르는 쪽. u 를 실제 좌표에 비례시켜야 한다 —
    // 직사각형 UV 를 사다리꼴에 씌우면 두 삼각형이 만나는 대각선에서 결이 꺾여
    // 모서리도 아닌 자리에 가짜 연귀가 하나 더 생긴다.
    // u/v 를 바꿔 넣는다: 결 캔버스가 선을 v 방향으로 긋기 때문에, 길이 방향을 v 에 실어야
    // 결이 레일을 따라 흐르고 이웃한 변에서 90도 꺾여 연귀가 눈에 보인다.
    const k = uScale / (2 * outer)
    uv.push(0, -inner * k, 0, inner * k, 1, outer * k, 0, -inner * k, 1, outer * k, 1, -outer * k)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  return geo
}

/**
 * 반상을 받치는 바닥 — 게임 테이블의 초록 펠트.
 *
 * 처음에는 풍화된 널판 사진을 재구성해 깔았다 (docs/table-recon/). 구조는 맞았지만 화면에서
 * 틀렸다: 차가운 회색이 따뜻한 반상과 색으로 싸우고, 이음매와 결이 구석에서 시선을 끌어
 * 게임판이 놓인 자리가 아니라 야외 데크로 읽혔다.
 *
 * 펠트는 반대로 간다. 구조가 없고 무광이라 뒤로 물러난다 — 바닥의 일은 그림자를 받는 것
 * 하나뿐이고, 그 외에는 눈에 띄지 않는 것이 잘하는 것이다.
 */
const FELT_SIZE = 60

/** 펠트 결 — 아주 잔 섬유 얼룩. 무늬가 보이기 시작하면 이미 과한 것이다. */
function feltTexture() {
  const px = 512
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  const felt = srgbOf(token('--table'))
  const tone = (m: number) => {
    const v = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255)
    return `rgb(${v(felt.r * m)},${v(felt.g * m)},${v(felt.b * m)})`
  }
  g.fillStyle = tone(1); g.fillRect(0, 0, px, px)
  const r = seeded(3391)
  // 섬유. 아주 짧은 선을 아무 방향으로 흩는다 — 짜인 천이 아니라 눌러 붙인 펠트다.
  for (let i = 0; i < 26000; i++) {
    const x = r() * px
    const y = r() * px
    const a = r() * Math.PI * 2
    const len = 1 + r() * 2.5
    g.strokeStyle = tone(r() < 0.5 ? 1.16 : 0.86)
    g.globalAlpha = 0.05 + r() * 0.07
    g.lineWidth = 0.8
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(10, 10)
  tex.anisotropy = 4
  return tex
}

function buildGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FELT_SIZE, FELT_SIZE),
    // 펠트는 하이라이트가 없다. roughness 를 끝까지 올려야 천으로 읽힌다.
    new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 1, metalness: 0 }),
  )
  ground.name = 'felt-ground'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -BOARD.thick
  ground.receiveShadow = true
  scene.add(ground)
}

function buildBoard() {
  const grain = new THREE.CanvasTexture(grainCanvas(1024, 20260818, '#ffffff', '#7a5a34', 900))
  grain.colorSpace = THREE.SRGBColorSpace
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping
  grain.anisotropy = 4
  // 거칠기는 색과 다른 씨앗으로 따로 만든다 — 한 장을 두 채널에 돌려 쓰면 결 골이
  // 어두워지는 곳과 거칠어지는 곳이 정확히 겹쳐 플라스틱처럼 보인다.
  const rough = new THREE.CanvasTexture(grainCanvas(512, 77712, '#9a9a9a', '#e8e8e8', 420))
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping

  const woodFrame = new THREE.MeshPhysicalMaterial({
    color: token('--board-frame'), roughness: 0.4, metalness: 0,
    // 니스는 진짜 클리어코트다. 옆면이 윗면보다 환하게 쓸리는 것이 이 층 때문이다.
    clearcoat: 0.35, clearcoatRoughness: 0.22,
    map: grain, roughnessMap: rough,
  })
  const tileMat = (name: string) => new THREE.MeshStandardMaterial({
    color: token(name), roughness: 0.38, metalness: 0, map: grain, roughnessMap: rough,
  })
  const lightMat = tileMat('--light')
  const darkMat = tileMat('--dark')

  // ---- 칸 64개. 두 덩어리로 합쳐 그린다 (밝은 것 한 번, 어두운 것 한 번).
  const build = (parity: number) => {
    const pos: number[] = []
    const uv: number[] = []
    const r = seeded(9137 + parity)
    for (let row = 0; row < 8; row++)
      for (let file = 0; file < 8; file++) {
        if ((file + row) % 2 !== parity) continue
        const x = file - 3.5
        const z = row - 3.5
        // 결 창을 칸마다 다른 자리에서 뜬다 — 64칸이 똑같은 무늬면 무늬가 아니라 격자다.
        const ou = r()
        const ov = r()
        const s = 0.22
        const quad = (
          p0: number[], p1: number[], p2: number[], p3: number[],
        ) => {
          // 반시계로 감아야 법선이 위를 본다. 시계로 감으면 칸이 통째로 뒷면이 되어 사라진다.
          pos.push(...p0, ...p3, ...p2, ...p0, ...p2, ...p1)
          const q: [number, number][] = [[ou, ov], [ou, ov + s], [ou + s, ov + s], [ou, ov], [ou + s, ov + s], [ou + s, ov]]
          for (const [u, v] of q) uv.push(parity ? v : u, parity ? u : v)
        }
        // 윗면 (y=0) — 실제로 보이는 면
        quad([x - 0.5, 0, z - 0.5], [x + 0.5, 0, z - 0.5], [x + 0.5, 0, z + 0.5], [x - 0.5, 0, z + 0.5])
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.computeVertexNormals()
    return geo
  }
  for (const [parity, mat] of [[0, lightMat], [1, darkMat]] as const) {
    const m = new THREE.Mesh(build(parity), mat)
    m.name = parity === 0 ? 'field-light' : 'field-dark'
    m.receiveShadow = true
    scene.add(m)
  }

  // ---- 테두리. 윗면 띠 + 모따기 띠 + 안쪽 벽으로 테를 닫는다.
  const outerTop = BOARD_HALF - BOARD.chamferW
  const frame = new THREE.Group()
  frame.name = 'frame-rail'
  for (const geo of [
    mitredRing(4, outerTop, 0, 0, 3),                                   // 윗면
    mitredRing(outerTop, BOARD_HALF, 0, -BOARD.chamferD, 3),            // 바깥 윗모서리 모따기
    mitredRing(4, 4, 0, -BOARD.tile, 3),                                // 안쪽 벽 (칸 옆면을 막는다)
  ]) {
    const m = new THREE.Mesh(geo, woodFrame)
    m.receiveShadow = true
    frame.add(m)
  }
  scene.add(frame)

  // ---- 슬랩. 모따기 아래부터 바닥까지. 옆면이 두께를 만든다.
  const bodyTop = -BOARD.chamferD
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_HALF * 2, BOARD.thick - BOARD.chamferD, BOARD_HALF * 2),
    woodFrame,
  )
  body.name = 'slab-body'
  body.position.y = bodyTop - (BOARD.thick - BOARD.chamferD) / 2
  body.receiveShadow = true
  // 바닥이 생겼으니 판도 그림자를 던져야 한다. 예전에는 받을 자리가 없어 끄고 있었다.
  body.castShadow = true
  scene.add(body)

  // 레퍼런스의 모서리 스플라인 홈(옆면 구석의 가는 줄 셋)은 넣지 않는다.
  // 이 카메라에서 옆면은 4px 남짓이라 0.014 폭의 홈은 서브픽셀이다 — 한 번도 보이지 않을
  // 메시 24개를 매 프레임 그리게 된다. 시점이 낮아지면 그때 되살릴 것.
}

// ---------------------------------------------------------------- 클릭

const raycaster = new THREE.Raycaster()
/** 반상 윗면 평면. 기물이 아니라 바닥을 맞혀야 기물에 가려진 칸도 집을 수 있다. */
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hitPoint = new THREE.Vector3()

function pick(e: PointerEvent): Square | null {
  const rect = canvasEl.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  )
  raycaster.setFromCamera(ndc, camera)
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null
  return worldToSquare(hitPoint.x, hitPoint.z)
}

// ---------------------------------------------------------------- 기물

interface Piece {
  root: THREE.Object3D
  base: THREE.Mesh
  mixer: THREE.AnimationMixer
  clips: THREE.AnimationClip[]
  color: Color
  type: PieceSymbol
  square: Square
  twoHanded: boolean
}

const pieces = new Map<Square, Piece>()
const cache = new Map<string, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>()
const loader = new GLTFLoader()
const BASE_COLOR = { w: token('--team-light'), b: token('--team-dark') }

/**
 * 기물 발밑 원판 — 참나무 통나무 단면 사진을 img2threejs 로 재구성한 것.
 * 스펙: docs/base-recon/object-sculpt-spec.json (strict-quality PASS)
 *
 * 레퍼런스에서 가져온 것 (실측한 반지름별 밝기 프로파일):
 *  - 껍질 테 (r/R 0.88~1.00, 두께가 둘레마다 다르다 → 윤곽이 원이 아니다)
 *  - 변재 띠 (0.72~0.88, 눈에 띄게 밝다 — 이게 "통나무 단면"으로 읽히게 하는 단서다)
 *  - 심재 (0.05~0.72) 와 어두운 수(0~0.05), 수는 한가운데가 아니다
 *  - 나이테 17줄, 바깥으로 갈수록 촘촘
 *  - 광택이 전혀 없다. 톱으로 자른 면이라 반상의 니스와 정반대다
 *
 * 색은 진영 토큰이 정한다. 밴드 대비를 12% 안쪽으로 눌러 둔 이유가 그것이다 —
 * 흰 쪽은 흰 쪽으로, 검은 쪽은 검은 쪽으로 남아야 어느 편인지가 한눈에 읽힌다.
 * 껍질 테만은 중간 갈색 쪽으로 섞는다. 검정 쪽으로 섞으면 검은 진영에서 사라진다.
 */
const BASE_R = 0.4
const BASE_H = 0.06
/** 나무 쪽으로 섞을 목표색. 밝은 진영에서는 어두워지고 어두운 진영에서는 밝아진다. */
const BASE_WOOD = { r: 0x6b, g: 0x4a, b: 0x2f }

function sliceTexture(teamLinear: THREE.Color) {
  const team = srgbOf(teamLinear)
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const mid = size / 2
  const lum = 0.2126 * team.r + 0.7152 * team.g + 0.0722 * team.b
  /**
   * 띠를 진영색에서 얼마나 떨어뜨릴지의 부호. 밝은 진영은 어둡게, 어두운 진영은 밝게 민다.
   * 레퍼런스대로 "변재가 가장 밝다" 를 비율로 옮기면 검은 진영에서는 0.767 배가 그냥
   * 검정이라 구조가 통째로 사라진다. 어두운 쪽에서는 명암을 뒤집어 그린다 — 세기는
   * 레퍼런스를 따르고 방향만 바꾼다.
   */
  const dir = lum > 0.5 ? -1 : 1
  /** dl 만큼 밀고, brown 만큼 나무색 쪽으로 섞는다. */
  const band = (dl: number, brown: number) => {
    const f = (v: number, w: number) => {
      const shifted = Math.min(1, Math.max(0, v + dir * dl))
      return Math.round((shifted * (1 - brown) + (w / 255) * brown) * 255)
    }
    return `rgb(${f(team.r, BASE_WOOD.r)},${f(team.g, BASE_WOOD.g)},${f(team.b, BASE_WOOD.b)})`
  }
  const r = seeded(4711)
  /**
   * 껍질 경계는 톱니가 아니라 몇 개의 큰 굴곡이다. 꼭짓점마다 난수를 주면 64개 이가 달린
   * 톱날이 된다 — 잘라 낸 나무가 아니라 기계 부품으로 읽힌다. 낮은 주파수 셋을 겹친다.
   */
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
  const blob = (radius: number, amp: number) => {
    g.beginPath()
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const w = Math.sin(a * 3 + ph[0]) * 0.5 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.sin(a * 8 + ph[2]) * 0.2
      const rr = radius * (1 + amp * w)
      const x = mid + Math.cos(a) * rr
      const y = mid + Math.sin(a) * rr
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.closePath()
    g.fill()
  }
  // 띠 반지름은 실측 프로파일을 따른다: 껍질 0.94~1.00, 변재 0.78~0.94, 심재 ~0.78.
  // 껍질을 두껍게 그리면 원판이 나무 단면이 아니라 접시 테두리로 읽힌다.
  g.fillStyle = band(0.14, 0.55); blob(mid, 0)             // 껍질
  g.fillStyle = band(0.00, 0.10); blob(mid * 0.94, 0.045)  // 변재 — 진영색에 가장 가깝다
  g.fillStyle = band(0.09, 0.22); blob(mid * 0.78, 0.030)  // 심재
  g.fillStyle = band(0.18, 0.34); blob(mid * 0.09, 0.150)  // 수

  // 나이테. 원판 한가운데가 아니라 수를 중심으로 돈다.
  const px = mid + mid * 0.07
  const py = mid + mid * 0.04
  g.strokeStyle = band(0.13, 0.28)
  /**
   * 34줄. 처음엔 17로 잡았는데, 반지름 프로파일을 4px 간격으로 훑는 바람에 나이테 주기가
   * 앨리어싱돼 절반으로 세어졌다. 레퍼런스와 나란히 놓고 보니 훨씬 촘촘하다 — 세는 방법이
   * 틀렸던 것이지 나무가 성긴 것이 아니었다.
   */
  const RINGS = 34
  for (let i = 1; i <= RINGS; i++) {
    // 바깥으로 갈수록 촘촘하게: 간격을 제곱근으로 준다.
    const rr = mid * 0.93 * Math.sqrt(i / RINGS)
    g.globalAlpha = 0.26 + r() * 0.20
    g.lineWidth = 0.6 + r() * 0.7
    g.beginPath()
    g.arc(px, py, rr, 0, Math.PI * 2)
    g.stroke()
  }
  // 톱자국 — 수에서 바깥으로 뻗는 가는 방사선.
  g.globalAlpha = 0.06
  g.lineWidth = 0.6
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2
    g.beginPath()
    g.moveTo(px, py)
    g.lineTo(px + Math.cos(a) * mid, py + Math.sin(a) * mid)
    g.stroke()
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 톱니 없는 원기둥 대신 둘레가 울퉁불퉁한 원기둥. 껍질이 붙은 단면은 정원이 아니다 —
 * 이 실루엣 하나가 "잘라 낸 나무"와 "플라스틱 칩"을 가른다.
 * 밑면은 만들지 않는다. 반상에 붙어 있어 한 번도 보이지 않는다.
 */
function sliceGeometry() {
  const seg = 28
  const r = seeded(1201)
  const rim = Array.from({ length: seg }, () => BASE_R * (1 - 0.05 * r()))
  const pos: number[] = []
  const uv: number[] = []
  const top = BASE_H / 2
  const at = (i: number) => {
    const a = (i / seg) * Math.PI * 2
    return { x: Math.cos(a) * rim[i % seg], z: Math.sin(a) * rim[i % seg] }
  }
  // UV 는 위에서 내려다본 평면 투영. 그래야 캔버스의 동심 띠가 그대로 얹힌다.
  const uvOf = (x: number, z: number) => [0.5 + x / (2 * BASE_R), 0.5 + z / (2 * BASE_R)]
  for (let i = 0; i < seg; i++) {
    const p = at(i)
    const q = at(i + 1)
    pos.push(0, top, 0, q.x, top, q.z, p.x, top, p.z)
    uv.push(0.5, 0.5, ...uvOf(q.x, q.z), ...uvOf(p.x, p.z))
    // 옆벽. 캔버스 가장자리를 물므로 저절로 껍질색이 된다.
    pos.push(p.x, top, p.z, q.x, top, q.z, q.x, -top, q.z)
    pos.push(p.x, top, p.z, q.x, -top, q.z, p.x, -top, p.z)
    const up = uvOf(p.x, p.z)
    const uq = uvOf(q.x, q.z)
    uv.push(...up, ...uq, ...uq, ...up, ...uq, ...up)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  return geo
}

const baseGeo = sliceGeometry()
/** 진영마다 하나씩. 기물마다 재질을 새로 만들면 32개가 된다. */
const baseMat: Record<Color, THREE.MeshStandardMaterial> = {
  // color 는 흰색으로 둔다. 진영색은 이미 캔버스에 구워져 있어서, 여기에 또 곱하면
  // 어두운 진영이 검정 위에 검정이 된다.
  w: new THREE.MeshStandardMaterial({ roughness: 0.92, map: sliceTexture(BASE_COLOR.w) }),
  b: new THREE.MeshStandardMaterial({ roughness: 0.92, map: sliceTexture(BASE_COLOR.b) }),
}

/** 몸은 항상 보인다. 무기·투구·모자·망토만 선택 대상. */
const OPTIONAL = /(Sword|Axe|Shield|Staff|Wand|Crossbow|Knife|Spellbook|Mug|Throwable|Helmet|Hat|Hood|Cape|Cloak|Badge|Quiver|Arrow|Offhand)/i
/**
 * 머리는 장비가 아니다. 이름에 장비 낱말이 섞여 있어도 몸이다 —
 * 두건 쓴 머리가 통째로 하나인 `Rogue_Head_Hooded` 가 "Hood" 때문에 장비로 걸려
 * 백 비숍이 목 없이 서 있었다. 벗길 수 있는 머리는 없다.
 */
const BODY = /Head/i

const isGear = (name: string) => OPTIONAL.test(name) && !BODY.test(name)

/**
 * three.js 는 glTF 노드 이름에서 애니메이션 경로 예약 문자(`.` 등)를 지운다.
 * 파일 안의 `handslot.r` 이 씬에서는 `handslotr` 이 되므로 문자만 남겨 비교한다.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

function findBone(root: THREE.Object3D, name: string) {
  let hit: THREE.Object3D | undefined
  root.traverse((o) => { if (!hit && norm(o.name) === norm(name)) hit = o })
  return hit
}

/** 본까지 재면 박스가 부푼다 — 보이는 메시만 모아야 배율이 맞는다. */
function meshBox(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.visible) return
    m.geometry.computeBoundingBox()
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld))
  })
  return box
}

async function load(path: string) {
  if (!cache.has(path)) {
    const gltf = await loader.loadAsync(path)
    cache.set(path, { scene: gltf.scene, clips: gltf.animations })
  }
  return cache.get(path)!
}

/** 모델 파일을 미리 받아 둔다. 첫 수에서 기물이 늦게 나타나지 않게. */
export async function preload() {
  const roles = [...Object.values(WHITE), ...Object.values(BLACK)]
  await Promise.all(roles.map((r) => load(`${MODELS}/${r.file}.glb`)))
  await Promise.all(
    roles.flatMap((r) => (r.hold ?? []).map((w) => load(`${MODELS}/gear/${w.file}.gltf`))),
  )
}

async function spawn(type: PieceSymbol, color: Color, square: Square): Promise<Piece> {
  const spec = ARMY[color][type]
  const src = await load(`${MODELS}/${spec.file}.glb`)
  const root = skinClone(src.scene)

  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return
    o.visible = !isGear(o.name) || (spec.gear ?? []).includes(o.name)
  })

  // 배율은 몸 기준으로 정한다. 무기를 먼저 붙이면 지팡이 하나가 키를 좌우한다.
  const box = meshBox(root)
  const size = new THREE.Vector3()
  box.getSize(size)
  const scale = spec.height / Math.max(size.y, 0.001)
  root.scale.setScalar(scale)
  root.userData.footY = -box.min.y * scale
  root.userData.height = spec.height

  for (const w of spec.hold ?? []) {
    const slot = findBone(root, w.bone)
    if (!slot) { console.warn(`${spec.file}: ${w.bone} 본이 없다`); continue }
    const gear = await load(`${MODELS}/gear/${w.file}.gltf`)
    slot.add(gear.scene.clone(true))
  }

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })

  const base = new THREE.Mesh(baseGeo, baseMat[color])
  base.receiveShadow = true
  scene.add(base, root)

  const mixer = new THREE.AnimationMixer(root)
  const idle = src.clips.find((c) => c.name === 'Idle') ?? src.clips[0]
  const action = mixer.clipAction(idle)
  action.play()
  // 같은 종이 여덟이면 숨이 딱딱 맞아 기계처럼 보인다. 위상을 흩는다.
  action.time = Math.random() * idle.duration

  const piece: Piece = { root, base, mixer, clips: src.clips, color, type, square, twoHanded: spec.twoHanded ?? false }
  moveTo(piece, square)
  return piece
}

/**
 * 서로를 마주 본다. 백은 -z(흑 진영), 흑은 +z(백 진영)를 향한다.
 * 모델의 정면이 +z 라서 회전이 필요한 쪽은 흑이 아니라 백이다 — 반대로 주면
 * 양쪽이 나란히 바깥을 보고 선다.
 */
const facing = (color: Color) => (color === 'w' ? Math.PI : 0)

function moveTo(piece: Piece, square: Square) {
  const { x, z } = squareToWorld(square)
  piece.root.position.set(x, piece.root.userData.footY, z)
  piece.base.position.set(x, 0.03, z)
  piece.root.rotation.y = facing(piece.color)
  piece.square = square
}

/** 조용한 수는 미끄러져 간다. 순간이동하면 3D 에서는 고장난 것처럼 보인다. */
export async function slide(from: Square, to: Square, ms = 240) {
  const piece = pieces.get(from)
  if (!piece) return
  const { x, z } = squareToWorld(to)
  await glide(piece, new THREE.Vector3(x, piece.root.userData.footY, z), ms)
}

function despawn(piece: Piece) {
  scene.remove(piece.root, piece.base)
  piece.mixer.stopAllAction()
}

/**
 * 반상 상태를 화면에 맞춘다. 같은 기물이 자리만 옮겼으면 새로 만들지 않고 옮긴다 —
 * 스킨 메시를 매 수마다 32개 복제하면 눈에 띄게 끊긴다.
 */
export async function sync(game: Chess) {
  clearEffects() // 무르기·새 게임으로 반상이 갈아엎히면 남은 타격 흔적도 지운다
  const want = new Map<Square, { type: PieceSymbol; color: Color }>()
  for (const row of game.board())
    for (const cell of row) if (cell) want.set(cell.square, { type: cell.type, color: cell.color })

  const stale: Piece[] = []
  for (const [sq, piece] of pieces) {
    const w = want.get(sq)
    if (w && w.type === piece.type && w.color === piece.color) { want.delete(sq); continue }
    stale.push(piece)
    pieces.delete(sq)
  }

  // 남은 자리에 같은 기물이 있으면 재사용한다 (= 그 기물이 이동한 것).
  for (const [sq, w] of [...want]) {
    const i = stale.findIndex((p) => p.type === w.type && p.color === w.color)
    if (i === -1) continue
    const piece = stale.splice(i, 1)[0]
    moveTo(piece, sq)
    pieces.set(sq, piece)
    want.delete(sq)
  }

  for (const piece of stale) despawn(piece)
  for (const [sq, w] of want) pieces.set(sq, await spawn(w.type, w.color, sq))

  // 전투에서 마주 보려고 틀어 둔 각도를 되돌린다. 공격을 버텨낸 기물은 제자리에 남아
  // moveTo 를 거치지 않으므로 여기서 안 세워 주면 계속 옆을 본다.
  for (const piece of pieces.values()) piece.root.rotation.y = facing(piece.color)
}

// ---------------------------------------------------------------- 표시

/**
 * 표시는 칸 전체를 물들인다. 2D 판에서 쓰던 가운데 점은 3D 에서 안 통한다 —
 * 원근 때문에 기물이 자기 바로 뒤 칸의 화면 자리를 통째로 덮어서, 킹을 고르면
 * 갈 수 있는 칸의 점이 킹의 투구 위에 찍힌다. depthTest 를 꺼도 마찬가지다.
 * 칸을 통째로 칠하면 기물 좌우로 삐져나온 부분이 남아 가려져도 읽힌다.
 */
const tint = (color: THREE.Color | number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, opacity, transparent: true })

const MARKER = {
  move: tint(token('--accent'), 0.34),
  capture: tint(token('--accent'), 0.6),
  selected: new THREE.MeshBasicMaterial({ color: token('--accent') }),
  last: tint(token('--last'), 0.3),
  check: tint(token('--danger'), 0.45),
  blocked: tint(token('--danger'), 0.5),
  blockedBar: new THREE.MeshBasicMaterial({ color: token('--danger') }),
  arrow: tint(token('--last'), 0.9),
  arrowRook: tint(token('--last'), 0.45), // 캐슬링에서 함께 움직인 룩 — 주인공은 킹이다
  arrowRepelled: tint(token('--danger'), 0.9),
  buff: tint(token('--buff'), 0.85),
}
const dotGeo = new THREE.CircleGeometry(0.15, 24)
const ringGeo = new THREE.RingGeometry(0.4, 0.47, 32)
const tileGeo2 = new THREE.PlaneGeometry(0.98, 0.98)
const barGeo = new THREE.PlaneGeometry(0.5, 0.085)
// 화살표는 길이가 매번 달라진다. 단위 상자를 늘려 쓰면 geometry 를 새로 만들지 않는다.
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const headGeo = new THREE.ConeGeometry(0.19, 0.34, 16)

function addMarker(square: Square, geo: THREE.BufferGeometry, mat: THREE.Material, y = 0.011) {
  const m = new THREE.Mesh(geo, mat)
  const { x, z } = squareToWorld(square)
  m.position.set(x, y, z)
  m.rotation.x = -Math.PI / 2
  // depthTest 를 끈 재질은 그리는 순서로만 앞뒤가 정해진다.
  markers.add(m)
}

/** 갈 수 없는 칸: 빨간 칸 + X. 초록(갈 수 있음)과 색으로 먼저 갈린다. */
function addCross(square: Square) {
  addMarker(square, tileGeo2, MARKER.blocked, 0.011)
  for (const roll of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(barGeo, MARKER.blockedBar)
    const { x, z } = squareToWorld(square)
    bar.position.set(x, 0.014, z)
    bar.rotation.set(-Math.PI / 2, 0, roll)
    markers.add(bar)
  }
}

/**
 * 직전 수를 반상 위에 화살표로 그린다. 칸 두 개만 물들이면 "어디서 어디로" 가 안 읽히고,
 * 특히 기물이 빽빽할 때 어느 기물이 움직였는지 알 수 없다.
 * 전투에 져서 무산된 수는 빨간 화살표 — 갔다가 죽었다는 뜻이다.
 */
function addArrow(from: Square, to: Square, material: THREE.Material) {
  const a = squareToWorld(from)
  const b = squareToWorld(to)
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return

  const head = 0.34
  // 도착 칸 한가운데까지 그리면 그 자리에 선 기물이 화살촉을 가린다. 칸 앞에서 끊는다.
  const reach = Math.max(0.4, length - 0.45)
  const shaftLength = Math.max(0.05, reach - head)

  const arrow = new THREE.Group()
  const shaft = new THREE.Mesh(unitBox, material)
  shaft.scale.set(0.12, 0.02, shaftLength)
  shaft.position.z = shaftLength / 2
  const tip = new THREE.Mesh(headGeo, material)
  tip.rotation.x = Math.PI / 2 // 콘은 +y 를 보므로 +z 로 눕힌다
  tip.position.z = shaftLength + head / 2
  arrow.add(shaft, tip)

  arrow.position.set(a.x, 0.02, a.z)
  // rotation.y = atan2(x, z) 면 로컬 +z 가 목표 방향을 가리킨다.
  arrow.rotation.y = Math.atan2(dx, dz)
  markers.add(arrow)
}

export interface Highlights {
  selected?: Square | null
  moves?: Square[]
  captures?: Square[]
  /** 잡을 수 있는 칸마다의 내 승산(0~1). 결투 모드에서만 온다. */
  odds?: { square: Square; chance: number }[]
  blocked?: Square[]
  last?: { from: Square; to: Square; repelled: boolean; rook?: [Square, Square] | null } | null
  check?: Square | null
}

export function highlight(h: Highlights) {
  markers.clear()
  if (h.last) {
    for (const sq of [h.last.from, h.last.to]) addMarker(sq, tileGeo2, MARKER.last, 0.009)
    addArrow(h.last.from, h.last.to, h.last.repelled ? MARKER.arrowRepelled : MARKER.arrow)
    // 캐슬링은 두 기물이 한 수에 움직인다. 룩을 안 그리면 킹이 룩을 뛰어넘은 것처럼 보인다.
    if (h.last.rook) {
      for (const sq of h.last.rook) addMarker(sq, tileGeo2, MARKER.last, 0.009)
      addArrow(h.last.rook[0], h.last.rook[1], MARKER.arrowRook)
    }
  }
  if (h.check) addMarker(h.check, tileGeo2, MARKER.check, 0.01)
  if (h.selected) addMarker(h.selected, ringGeo, MARKER.selected, 0.012)
  for (const sq of h.moves ?? []) {
    addMarker(sq, tileGeo2, MARKER.move, 0.011)
    addMarker(sq, dotGeo, MARKER.capture, 0.012)
  }
  for (const sq of h.captures ?? []) {
    addMarker(sq, tileGeo2, MARKER.move, 0.011)
    addMarker(sq, ringGeo, MARKER.capture, 0.012)
  }
  for (const sq of h.blocked ?? []) addCross(sq)
  for (const o of h.odds ?? []) addOdds(o.square, o.chance)
}

/**
 * 잡을 수 있는 칸 위에 승산을 띄운다.
 *
 * 잡기가 확률인데 그 확률을 붙기 전에는 볼 수 없었다 — 계기판은 이미 칼을 뽑은 뒤에야
 * 열린다. 고를 때 알아야 고르는 것이 된다.
 *
 * 숫자는 그 칸에 선 기물 머리 위로 올린다. 발밑에 두면 기물이 가린다.
 */
const oddsTextures = new Map<string, THREE.SpriteMaterial>()
function oddsMaterial(chance: number) {
  const pct = Math.round(chance * 100)
  // 계기판과 같은 뜻: 유리하면 --accent, 불리하면 --danger.
  const color = pct >= 50 ? token('--accent') : token('--danger')
  const key = `${pct}`
  let mat = oddsTextures.get(key)
  if (!mat) {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const g = c.getContext('2d')!
    g.font = 'bold 44px system-ui, "Apple SD Gothic Neo", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // 반상 위 어디에 떠도 읽히게 글자 뒤를 깐다.
    g.fillStyle = 'rgba(0,0,0,0.55)'
    g.beginPath()
    g.roundRect(6, 8, 116, 48, 10)
    g.fill()
    g.fillStyle = `#${color.getHexString()}`
    g.fillText(`${pct}%`, 64, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    oddsTextures.set(key, mat)
  }
  return mat
}

function addOdds(square: Square, chance: number) {
  const { x, z } = squareToWorld(square)
  const s = new THREE.Sprite(oddsMaterial(chance))
  s.scale.set(0.86, 0.43, 1)
  s.position.set(x, 1.62, z)
  s.renderOrder = 10
  markers.add(s)
}

// ---------------------------------------------------------------- 체력 표시

const HP_BAR = {
  back: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
  fill: new THREE.MeshBasicMaterial({ color: token('--accent') }),
  hurt: new THREE.MeshBasicMaterial({ color: token('--danger') }),
}
const hpBackGeo = new THREE.PlaneGeometry(0.62, 0.1)
const hpFillGeo = new THREE.PlaneGeometry(0.58, 0.062)

/**
 * 다친 기물 머리 위에만 체력 바를 세운다. 만피는 표시하지 않는다 — 32개가 전부 떠 있으면
 * 반상이 계기판이 된다. 카메라를 향해 세우는 것은 tick() 에서 매 프레임 맞춘다.
 */
export function showHealth(list: { square: Square; ratio: number }[]) {
  healthBars.clear()
  for (const { square, ratio } of list) {
    const piece = pieces.get(square)
    if (!piece) continue
    const y = piece.root.position.y + (piece.root.userData.height ?? 1) + 0.28
    const { x, z } = squareToWorld(square)

    const back = new THREE.Mesh(hpBackGeo, HP_BAR.back)
    back.position.set(x, y, z)
    back.renderOrder = 4
    const fill = new THREE.Mesh(hpFillGeo, ratio <= 0.3 ? HP_BAR.hurt : HP_BAR.fill)
    // 왼쪽부터 줄어들게: 폭을 줄이고 그만큼 왼쪽으로 민다.
    fill.scale.x = Math.max(0.02, ratio)
    fill.position.set(x - (0.58 * (1 - ratio)) / 2, y, z)
    fill.renderOrder = 5
    healthBars.add(back, fill)
  }
}

// ---------------------------------------------------------------- 아이템

/** 낙인 자국은 평평한 판에 그린다 — 테두리가 고르지 않아야 눌러 지진 자국으로 읽힌다. */
const itemBaseGeo = new THREE.PlaneGeometry(0.94, 0.94)
const itemMaterials = new Map<string, { gem: THREE.SpriteMaterial; ring: THREE.Material }>()

/**
 * 아이템은 기호로 그린다. 색만으로는 초록이 회복인지 공격력인지 매번 안내줄을 봐야 했다.
 * 3D 로 기호를 세우면 시점에 따라 찌그러지므로 늘 카메라를 마주 보는 스프라이트를 쓴다 —
 * 캔버스에 글자 하나 그린 텍스처가 전부다.
 */
function glyphTexture(glyph: string, color: THREE.Color) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.font = '96px system-ui, "Apple SD Gothic Neo", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = '#000'
  g.shadowBlur = 10
  g.fillStyle = `#${color.getHexString()}`
  g.fillText(glyph, 64, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 발밑 표식 — 반상에 지진 낙인 자국.
 *
 * 예전에는 매끈한 `RingGeometry` 였다. 반상이 나무가 된 뒤로 그 평평한 색 테가 장면에서
 * 유일하게 표면이 없는 물건이 됐다. 낙인은 판 위에 얹힌 것이 아니라 판에 새겨진 것이라,
 * 나무 위에 있어야 할 이유가 생긴다.
 *
 *  - 테두리가 고르지 않다. 쇠는 고르게 눌리지 않는다 (낮은 주파수 셋).
 *  - 그을음이 바깥으로 번진다.
 *  - 탄 자국 안쪽에 아이템 색이 남는다 — 색 구분은 그대로 살아야 한다.
 */
function brandTexture(color: THREE.Color) {
  const px = 256
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  const mid = px / 2
  const r = seeded(60317)
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
  const lobe = (a: number) =>
    1 + 0.055 * (Math.sin(a * 3 + ph[0]) * 0.5 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.sin(a * 8 + ph[2]) * 0.2)
  const ring = (radius: number, width: number, style: string, alpha: number, blur: number) => {
    g.strokeStyle = style
    g.globalAlpha = alpha
    g.lineWidth = width
    g.shadowColor = style
    g.shadowBlur = blur
    g.beginPath()
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const rr = radius * lobe(a)
      const x = mid + Math.cos(a) * rr
      const y = mid + Math.sin(a) * rr
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.closePath()
    g.stroke()
  }
  // 그을음이 먼저, 그 위에 탄 테, 마지막에 아이템 색. 순서를 바꾸면 색이 그을음에 묻힌다.
  //
  // 색 선은 굵고 밝게 간다. 낙인은 매끈한 색 테보다 어두워서 그대로 두면 "여기 뭔가 있다"
  // 는 표식 본래의 일이 깎인다 — 장면에 어울리게 만들다가 안 보이게 만들면 진 것이다.
  ring(mid * 0.70, 26, '#1a0f06', 0.34, 14)
  ring(mid * 0.70, 14, '#2b1c10', 0.92, 4)
  ring(mid * 0.70, 7, `#${color.getHexString()}`, 1, 7)
  // 지질 때 삐져나온 자국 몇 개.
  g.shadowBlur = 0
  g.globalAlpha = 0.5
  g.strokeStyle = '#2b1c10'
  g.lineWidth = 2.5
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2
    const r0 = mid * 0.70 * lobe(a)
    g.beginPath()
    g.moveTo(mid + Math.cos(a) * r0, mid + Math.sin(a) * r0)
    g.lineTo(mid + Math.cos(a) * (r0 + 6 + r() * 12), mid + Math.sin(a) * (r0 + 6 + r() * 12))
    g.stroke()
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const itemMaterial = (name: string, glyph: string) => {
  const key = `${name}${glyph}`
  let m = itemMaterials.get(key)
  if (!m) {
    const color = token(name)
    m = {
      gem: new THREE.SpriteMaterial({ map: glyphTexture(glyph, color), transparent: true }),
      ring: new THREE.MeshBasicMaterial({
        map: brandTexture(color), transparent: true, depthWrite: false,
      }),
    }
    itemMaterials.set(key, m)
  }
  return m
}

/** 반상 위 아이템. 칸 위에 떠서 흔들리고, 바닥에 같은 색 고리를 둔다. */
export function showItems(list: { square: Square; token: string; glyph: string }[]) {
  itemGroup.clear()
  for (const { square, token: name, glyph } of list) {
    const { x, z } = squareToWorld(square)
    const mat = itemMaterial(name, glyph)
    const gem = new THREE.Sprite(mat.gem)
    gem.scale.setScalar(0.68)
    gem.position.set(x, 0.5, z)
    const ring = new THREE.Mesh(itemBaseGeo, mat.ring)
    ring.position.set(x, 0.012, z)
    ring.rotation.x = -Math.PI / 2
    itemGroup.add(gem, ring)
  }
}

// 아이템 고리는 빈 칸에 놓이지만 이 고리는 기물이 선 칸에 놓인다.
// 기물 받침(baseGeo, 반지름 0.4)보다 바깥이라야 보인다 — 안쪽에 그리면 받침에 덮인다.
const buffRingGeo = new THREE.RingGeometry(0.42, 0.48, 32)

/** 능력을 얻은 기물 발밑 고리. 어느 기물이 특별한지 반상에서 보이게. */
export function showBuffed(squares: Square[]) {
  for (const square of squares) {
    const { x, z } = squareToWorld(square)
    const ring = new THREE.Mesh(buffRingGeo, MARKER.buff)
    ring.position.set(x, 0.013, z)
    ring.rotation.x = -Math.PI / 2
    markers.add(ring)
  }
}

// ---------------------------------------------------------------- 카메라

const BOARD_VIEW = { y: 11.2, z: 9.4 }
/** 이 비율에서 비스듬한 시점이 딱 맞는다. 반상은 이보다 좁은 화면을 가로로 못 채운다. */
const WIDE = 1.32
/** 반상 바깥 반폭 + 여유. 이만큼은 가로 시야에 들어와야 양옆이 안 잘린다. */
const HALF = BOARD_HALF + 0.13

/**
 * 화면이 세로로 길수록 위에서 내려다본다.
 *
 * 비스듬히 보면 8×8 반상이 가로로 긴 모양(약 1.32:1)으로 투영된다. 세로로 긴 폰에서는
 * 그 모양이 폭에 먼저 부딪혀 화면 높이가 통째로 남는다 — 캔버스만 키워 봐야 위아래가
 * 검게 빌 뿐이다. 시점을 세우면 투영이 정사각형에 가까워져 높이를 쓴다.
 */
function viewFor(aspect: number) {
  const tilt = Math.min(1, Math.max(0, (WIDE - aspect) / (WIDE - 0.8)))
  const y = BOARD_VIEW.y + 3.4 * tilt
  const z = BOARD_VIEW.z * (1 - 0.5 * tilt)
  // 세워도 좁으면 양옆이 잘린다. 남은 만큼만 뒤로 물러선다.
  const tan = Math.tan((camera.fov * Math.PI) / 360)
  const pull = Math.max(1, HALF / (Math.hypot(y, z) * tan * aspect))
  return { y: y * pull, z: z * pull }
}

export function setOrientation(human: Color) {
  flipped = human === 'b'
  if (!cameraLocked) resetCamera()
}

function resetCamera() {
  const sign = flipped ? -1 : 1
  const { y, z } = viewFor(camera.aspect || WIDE)
  camera.position.set(0, y, z * sign)
  camera.lookAt(0, 0.15, 0)
}

export function resize() {
  const w = canvasEl.clientWidth
  const h = canvasEl.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  // 화면을 돌리면 비율이 바뀐다 — 물러서는 정도도 다시 잡는다.
  if (!cameraLocked) resetCamera()
}

// ---------------------------------------------------------------- 타격 이펙트

/**
 * 타격이 눈에 보여야 한다. 전에는 공격 모션과 숫자뿐이라, 때린 순간이 화면에서 지나갔다.
 *
 * 판정은 이미 `combat.ts` 가 끝냈다 (DESIGN: 전투 결과를 화면에서 계산하지 않는다).
 * 여기서 읽는 것은 "치명타였나" 하나뿐이고, 나머지는 재생이다.
 */
interface Effect {
  obj: THREE.Mesh
  age: number
  life: number
  /** 시작·끝 배율. 고리는 퍼지고 파편은 그대로다. */
  from: number
  to: number
  /** 있으면 날아간다 (파편). */
  velocity?: THREE.Vector3
  /** 있으면 언제나 카메라를 마주 본다 (고리·초승달). */
  billboard?: boolean
}

const effects: Effect[] = []
/** 퍼지는 고리 — 맞은 자리. */
const flashGeo = new THREE.RingGeometry(0.16, 0.3, 24)
/** 초승달 — 때린 방향. 어느 쪽에서 들어온 타격인지 읽힌다. */
const slashGeo = new THREE.RingGeometry(0.34, 0.5, 24, 1, Math.PI * 0.18, Math.PI * 0.64)
const sparkGeo = new THREE.SphereGeometry(0.032, 6, 4)

function emit(geo: THREE.BufferGeometry, color: THREE.Color, at: THREE.Vector3, e: Omit<Effect, 'obj' | 'age'>) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }))
  mesh.position.copy(at)
  mesh.scale.setScalar(e.from)
  fxGroup.add(mesh)
  effects.push({ obj: mesh, age: 0, ...e })
  return mesh
}

/** 맞은 기물 가슴께. 발밑에 그리면 기물에 가려 안 보인다. */
const chest = (p: Piece) => p.root.position.clone().setY(0.62)

function playStrike(hitter: Piece, victim: Piece, crit: boolean) {
  const color = token(crit ? '--crit' : '--danger')
  const at = chest(victim)
  const size = crit ? 1.45 : 1

  emit(flashGeo, color, at, { life: 0.28, from: 0.45 * size, to: 1.5 * size, billboard: true })

  // 초승달은 때린 쪽에서 맞은 쪽을 향해 눕는다.
  const slash = emit(slashGeo, color, at, { life: 0.22, from: 0.75 * size, to: 1.25 * size })
  const dir = hitter.root.position.clone().sub(victim.root.position).setY(0)
  slash.lookAt(at.clone().add(dir))
  slash.rotateZ(Math.PI / 2)

  for (let i = 0; i < (crit ? 9 : 5); i++) {
    const a = Math.random() * Math.PI * 2
    const up = 1.6 + Math.random() * 1.8
    emit(sparkGeo, color, at, {
      life: 0.42, from: size, to: size,
      velocity: new THREE.Vector3(Math.cos(a) * 1.5, up, Math.sin(a) * 1.5),
    })
  }
}

/** 남은 이펙트를 지운다 — 새 게임·무르기에서 전투 흔적이 남지 않게. */
function clearEffects() {
  for (const e of effects) (e.obj.material as THREE.Material).dispose()
  effects.length = 0
  fxGroup.clear()
}

function stepEffects(dt: number) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]
    e.age += dt
    const t = e.age / e.life
    if (t >= 1) {
      ;(e.obj.material as THREE.Material).dispose()
      fxGroup.remove(e.obj)
      effects.splice(i, 1)
      continue
    }
    e.obj.scale.setScalar(e.from + (e.to - e.from) * t)
    ;(e.obj.material as THREE.MeshBasicMaterial).opacity = 1 - t * t
    if (e.velocity) {
      e.obj.position.addScaledVector(e.velocity, dt)
      e.velocity.y -= 7 * dt // 파편은 떨어진다
    }
    if (e.billboard) e.obj.quaternion.copy(camera.quaternion)
  }
}

// ---------------------------------------------------------------- 전투

/**
 * 전투 재생을 빨리 감는다. 판정은 이미 끝나 있으므로 건너뛰어도 결과가 달라지지 않는다 —
 * 기다리는 것들(sleep·카메라·활강)만 그 자리에서 끝난다.
 *
 * 전투가 도는 동안에만 받는다. 끝난 뒤에 들어온 요청까지 켜 두면 그 상태가 남아, 다음
 * 수의 활강과 그 다음 전투까지 통째로 순간이동한다 — "한 번 건너뛰면 그 뒤로 전부
 * 건너뛴다" 가 이것이었다.
 */
let skipping = false
let duelActive = false
export const skipDuel = () => { if (duelActive) skipping = true }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, skipping ? 0 : ms))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** 카메라를 목표 위치로 부드럽게 옮긴다. */
async function flyCamera(to: THREE.Vector3, look: THREE.Vector3, ms: number) {
  const from = camera.position.clone()
  const start = performance.now()
  for (;;) {
    const t = skipping ? 1 : Math.min(1, (performance.now() - start) / ms)
    camera.position.lerpVectors(from, to, easeInOut(t))
    camera.lookAt(look)
    if (t >= 1) return
    await new Promise(requestAnimationFrame)
  }
}

function play(piece: Piece, name: string, loop = false) {
  const clip = piece.clips.find((c) => c.name === name)
  if (!clip) return 0
  const action = piece.mixer.clipAction(clip)
  action.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1).play()
  action.clampWhenFinished = !loop
  return clip.duration * 1000
}

/** 기물 하나를 목표 지점까지 미끄러뜨린다 (발판도 같이). */
async function glide(piece: Piece, to: THREE.Vector3, ms: number) {
  const from = piece.root.position.clone()
  const start = performance.now()
  for (;;) {
    const t = skipping ? 1 : Math.min(1, (performance.now() - start) / ms)
    piece.root.position.lerpVectors(from, to, easeInOut(t))
    piece.base.position.set(piece.root.position.x, 0.03, piece.root.position.z)
    if (t >= 1) return
    await new Promise(requestAnimationFrame)
  }
}

function faceEachOther(a: Piece, b: Piece) {
  const angle = Math.atan2(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z)
  a.root.rotation.y = angle
  b.root.rotation.y = angle + Math.PI
}

export interface DuelStrike { by: 'attacker' | 'defender'; damage: number; crit: boolean }

/**
 * 반상 위에서 전투를 재생한다. 승패는 이미 정해져 있고 여기서는 보여주기만 한다.
 * onStrike 로 타격마다 화면 밖(HP 바)을 갱신할 기회를 준다.
 */
export async function playDuel(
  attackerSquare: Square,
  defenderSquare: Square,
  strikes: DuelStrike[],
  attackerWon: boolean,
  onStrike: (index: number) => void,
) {
  const attacker = pieces.get(attackerSquare)
  const defender = pieces.get(defenderSquare)
  if (!attacker || !defender) return

  skipping = false
  duelActive = true
  cameraLocked = true

  // 공격자를 수비 기물 바로 앞까지 데려온다. 원래 자리에 세워 두면 룩이 반상 끝에서
  // 칼을 휘두르는 꼴이 되고, 멀수록 둘이 화면 양끝으로 벌어져 누가 싸우는지 안 보인다.
  const home = attacker.root.position.clone()
  const approach = defender.root.position.clone().sub(home).setY(0)
  const stage = approach.length() > 1.2
    ? defender.root.position.clone().sub(approach.clone().normalize().multiplyScalar(1))
    : home.clone()
  stage.y = home.y
  faceEachOther(attacker, defender)
  if (!stage.equals(home)) await glide(attacker, stage, 380)

  const mid = attacker.root.position.clone().add(defender.root.position).multiplyScalar(0.5)
  const sign = flipped ? -1 : 1
  const seat = mid.clone().add(new THREE.Vector3(0.5 * sign, 1.9, 2.9 * sign))
  const look = mid.clone().setY(0.55)
  await flyCamera(seat, look, 520)

  const step = Math.min(700, 4200 / Math.max(strikes.length, 1))
  for (let i = 0; i < strikes.length; i++) {
    const s = strikes[i]
    const [hitter, victim] = s.by === 'attacker' ? [attacker, defender] : [defender, attacker]
    play(hitter, hitter.twoHanded ? 'Attack_2H' : 'Attack_1H')
    onStrike(i)
    await sleep(step * 0.45)
    play(victim, 'Hit')
    playStrike(hitter, victim, s.crit)
    await sleep(step * 0.55)
  }

  const loser = attackerWon ? defender : attacker
  const winner = attackerWon ? attacker : defender
  play(loser, 'Death')
  play(winner, 'Idle', true)
  await sleep(900)

  cameraLocked = false
  const back = viewFor(camera.aspect || WIDE)
  skipping = false
  duelActive = false
  await flyCamera(
    new THREE.Vector3(0, back.y, back.z * sign),
    new THREE.Vector3(0, 0.15, 0),
    460,
  )
}

// ---------------------------------------------------------------- 루프

function tick() {
  const dt = clock.getDelta()
  for (const p of pieces.values()) p.mixer.update(dt)
  // 체력 바는 언제나 카메라를 마주 본다. 결투 중에는 카메라가 크게 움직인다.
  for (const bar of healthBars.children) bar.quaternion.copy(camera.quaternion)
  // 아이템은 떠서 돌며 위아래로 흔들린다 — 반상의 정적인 것들과 구분된다.
  stepEffects(dt)
  spin += dt
  for (const obj of itemGroup.children) {
    if (!(obj as THREE.Sprite).isSprite) continue
    obj.position.y = 0.5 + Math.sin(spin * 2) * 0.06
  }
  renderer.render(scene, camera)
}
