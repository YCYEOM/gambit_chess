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
const clock = new THREE.Clock()
let spin = 0

const token = (name: string) =>
  new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim())

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
  scene.add(markers, healthBars, itemGroup)

  canvas.addEventListener('pointerdown', (e) => {
    const sq = pick(e)
    if (sq) onPick(sq)
  })

  resetCamera()
  resize()
  renderer.setAnimationLoop(tick)
}

function buildBoard() {
  const lightMat = new THREE.MeshStandardMaterial({ color: token('--light'), roughness: 0.8 })
  const darkMat = new THREE.MeshStandardMaterial({ color: token('--dark'), roughness: 0.8 })
  const tileGeo = new THREE.BoxGeometry(1, 0.16, 1)

  for (let row = 0; row < 8; row++)
    for (let file = 0; file < 8; file++) {
      const tile = new THREE.Mesh(tileGeo, (file + row) % 2 === 0 ? lightMat : darkMat)
      tile.position.set(file - 3.5, -0.08, row - 3.5)
      tile.receiveShadow = true
      scene.add(tile)
    }

  // 테두리 — 판이 공중에 뜬 조각이 아니라 하나의 물건으로 보이게.
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(8.7, 0.3, 8.7),
    new THREE.MeshStandardMaterial({ color: token('--panel'), roughness: 0.6 }),
  )
  frame.position.y = -0.2
  frame.receiveShadow = true
  scene.add(frame)
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
const baseGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.06, 32)

/** 몸은 항상 보인다. 무기·투구·모자·망토만 선택 대상. */
const OPTIONAL = /(Sword|Axe|Shield|Staff|Wand|Crossbow|Knife|Spellbook|Mug|Throwable|Helmet|Hat|Hood|Cape|Cloak|Badge|Quiver|Arrow|Offhand)/i

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
    o.visible = !OPTIONAL.test(o.name) || (spec.gear ?? []).includes(o.name)
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

  const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: BASE_COLOR[color], roughness: 0.5 }))
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
function addArrow(from: Square, to: Square, repelled: boolean) {
  const a = squareToWorld(from)
  const b = squareToWorld(to)
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return

  const material = repelled ? MARKER.arrowRepelled : MARKER.arrow
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
  blocked?: Square[]
  last?: { from: Square; to: Square; repelled: boolean } | null
  check?: Square | null
}

export function highlight(h: Highlights) {
  markers.clear()
  if (h.last) {
    for (const sq of [h.last.from, h.last.to]) addMarker(sq, tileGeo2, MARKER.last, 0.009)
    addArrow(h.last.from, h.last.to, h.last.repelled)
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

const itemGeo = new THREE.OctahedronGeometry(0.2)
const itemBaseGeo = new THREE.RingGeometry(0.3, 0.38, 32)
const itemMaterials = new Map<string, { gem: THREE.Material; ring: THREE.Material }>()

const itemMaterial = (name: string) => {
  let m = itemMaterials.get(name)
  if (!m) {
    const color = token(name)
    m = {
      gem: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.3 }),
      ring: tint(color, 0.55),
    }
    itemMaterials.set(name, m)
  }
  return m
}

/** 반상 위 아이템. 칸 위에 떠서 돌고, 바닥에 같은 색 고리를 둔다. */
export function showItems(list: { square: Square; token: string }[]) {
  itemGroup.clear()
  for (const { square, token: name } of list) {
    const { x, z } = squareToWorld(square)
    const mat = itemMaterial(name)
    const gem = new THREE.Mesh(itemGeo, mat.gem)
    gem.position.set(x, 0.45, z)
    gem.castShadow = true
    const ring = new THREE.Mesh(itemBaseGeo, mat.ring)
    ring.position.set(x, 0.012, z)
    ring.rotation.x = -Math.PI / 2
    itemGroup.add(gem, ring)
  }
}

/** 능력을 얻은 기물 발밑 고리. 어느 기물이 특별한지 반상에서 보이게. */
export function showBuffed(squares: Square[]) {
  for (const square of squares) {
    const { x, z } = squareToWorld(square)
    const ring = new THREE.Mesh(itemBaseGeo, MARKER.buff)
    ring.position.set(x, 0.013, z)
    ring.rotation.x = -Math.PI / 2
    markers.add(ring)
  }
}

// ---------------------------------------------------------------- 카메라

const BOARD_VIEW = { y: 11.2, z: 9.4 }

export function setOrientation(human: Color) {
  flipped = human === 'b'
  if (!cameraLocked) resetCamera()
}

function resetCamera() {
  const sign = flipped ? -1 : 1
  camera.position.set(0, BOARD_VIEW.y, BOARD_VIEW.z * sign)
  camera.lookAt(0, 0.15, 0)
}

export function resize() {
  const w = canvasEl.clientWidth
  const h = canvasEl.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

// ---------------------------------------------------------------- 전투

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** 카메라를 목표 위치로 부드럽게 옮긴다. */
async function flyCamera(to: THREE.Vector3, look: THREE.Vector3, ms: number) {
  const from = camera.position.clone()
  const start = performance.now()
  for (;;) {
    const t = Math.min(1, (performance.now() - start) / ms)
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
    const t = Math.min(1, (performance.now() - start) / ms)
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
    await sleep(step * 0.55)
  }

  const loser = attackerWon ? defender : attacker
  const winner = attackerWon ? attacker : defender
  play(loser, 'Death')
  play(winner, 'Idle', true)
  await sleep(900)

  cameraLocked = false
  await flyCamera(
    new THREE.Vector3(0, BOARD_VIEW.y, BOARD_VIEW.z * sign),
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
  spin += dt
  for (const obj of itemGroup.children) {
    if ((obj as THREE.Mesh).geometry !== itemGeo) continue
    obj.rotation.y = spin * 1.6
    obj.position.y = 0.45 + Math.sin(spin * 2) * 0.06
  }
  renderer.render(scene, camera)
}
