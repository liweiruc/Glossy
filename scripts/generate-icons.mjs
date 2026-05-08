// Generates public/icons/icon-192.png and public/icons/icon-512.png
// Amber (#BA7517) background with a white "L" shape drawn from rectangles.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))])
}

function makeIcon(size) {
  const bg = [0xBA, 0x75, 0x17]   // #BA7517 amber
  const wh = [0xFF, 0xFF, 0xFF]   // white

  const mg = Math.round(size * 0.25)   // 25% margin on each side
  const sw = Math.round(size * 0.145)  // stroke width ~14.5%
  const ed = size - mg                  // inner edge

  // L = vertical bar [mg..mg+sw, mg..ed] ∪ horizontal bar [mg..ed, ed-sw..ed]
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = [0] // PNG filter byte: None
    for (let x = 0; x < size; x++) {
      const v = x >= mg && x < mg + sw && y >= mg && y < ed
      const h = x >= mg && x < ed && y >= ed - sw && y < ed
      row.push(...(v || h ? wh : bg))
    }
    rows.push(Buffer.from(row))
  }

  const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8, 2, 0, 0, 0])])
  const idat = deflateSync(Buffer.concat(rows), { level: 9 })

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', makeIcon(192))
writeFileSync('public/icons/icon-512.png', makeIcon(512))
console.log('✓ public/icons/icon-192.png')
console.log('✓ public/icons/icon-512.png')
