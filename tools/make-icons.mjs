/**
 * 앱 아이콘을 그린다. `node tools/make-icons.mjs`
 *
 * 이미지 라이브러리를 붙이지 않는다 — PNG 는 압축만 zlib 이고 나머지는 헤더 몇 개라,
 * 픽셀을 직접 찍는 편이 의존성 하나보다 싸다. 색은 index.html 의 토큰 그대로다.
 *
 * 아이콘은 반상 그 자체다. 기물 실루엣은 작은 크기에서 뭉개지고, 체크무늬는 16px 에서도
 * "체스" 로 읽힌다. 초록 한 칸은 고른 칸(--accent), 노란 한 칸은 직전 수(--last)다.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const COLORS = {
  bg: [0x26, 0x24, 0x21],
  light: [0xee, 0xdd, 0xc0],
  dark: [0xb5, 0x88, 0x63],
  frame: [0x31, 0x2e, 0x2b],
  accent: [0x7f, 0xa6, 0x50],
  last: [0xff, 0xe0, 0x66],
}

/** 8×8 반상을 그린다. pad 가 클수록 반상이 작아진다 (maskable 안전 영역). */
function pixels(size, pad) {
  const buf = Buffer.alloc(size * size * 3)
  const board = Math.round(size * (1 - pad * 2))
  const start = Math.round((size - board) / 2)
  const frame = Math.max(2, Math.round(board * 0.05))
  const cell = (board - frame * 2) / 8

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bx = x - start
      const by = y - start
      let c = COLORS.bg
      if (bx >= 0 && by >= 0 && bx < board && by < board) {
        c = COLORS.frame
        const ix = bx - frame
        const iy = by - frame
        if (ix >= 0 && iy >= 0 && ix < cell * 8 && iy < cell * 8) {
          const file = Math.floor(ix / cell)
          const rank = Math.floor(iy / cell)
          c = (file + rank) % 2 === 0 ? COLORS.light : COLORS.dark
          if (file === 3 && rank === 4) c = COLORS.accent // 고른 칸
          if (file === 4 && rank === 2) c = COLORS.last // 직전 수
        }
      }
      const i = (y * size + x) * 3
      buf[i] = c[0]
      buf[i + 1] = c[1]
      buf[i + 2] = c[2]
    }
  }
  return buf
}

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (b) => {
  let c = -1
  for (const byte of b) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, tail])
}

function png(size, pad) {
  const rgb = pixels(size, pad)
  // 스캔라인마다 필터 바이트(0 = 그대로)가 앞에 붙는다.
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 채널당 8비트
  ihdr[9] = 2 // 트루컬러
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size, pad] of [
  ['icon-192.png', 192, 0.06],
  ['icon-512.png', 512, 0.06],
  ['icon-maskable-512.png', 512, 0.2], // 마스크가 잘라도 남을 만큼 안쪽에
  ['apple-touch-icon.png', 180, 0.06], // iOS 는 매니페스트가 아니라 이 파일을 쓴다
]) {
  const out = png(size, pad)
  writeFileSync(new URL(`../public/${name}`, import.meta.url), out)
  console.log(name, `${(out.length / 1024).toFixed(1)}KB`)
}
