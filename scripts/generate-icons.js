const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  // Raw RGBA scanlines with filter byte 0 prefix
  const stride = width * 4;
  const rawData = Buffer.alloc(height * (stride + 1));

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.35 : 0.42);
  const innerRadius = radius * 0.72;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background color: Slate 950 #020617
      let r = 2, g = 6, b = 23, a = 255;

      if (!isMaskable) {
        // Rounded app icon border
        const cornerDist = Math.max(Math.abs(dx) - (width * 0.4), Math.abs(dy) - (height * 0.4));
        // Subtle outer glow
        if (dist < width * 0.48) {
          r = 15; g = 23; b = 42;
        }
      }

      // Checkers Piece Base (Circular Disc)
      if (dist <= radius) {
        const edgeRatio = dist / radius;
        // 3D Bevel shading on outer rim
        const lightAngle = Math.atan2(dy - radius * 0.3, dx - radius * 0.3);
        const specular = Math.cos(lightAngle);

        if (dist >= radius * 0.88) {
          // Outer Gold Rim / Metallic border
          r = Math.floor(217 + specular * 30);
          g = Math.floor(119 + specular * 25);
          b = Math.floor(6 + specular * 10);
        } else if (dist >= innerRadius) {
          // Mid Beveled Tier (Ruby Red Gradient)
          const grad = (y / height);
          r = Math.min(255, Math.floor(220 - grad * 60 + (1 - edgeRatio) * 40));
          g = Math.floor(38 - grad * 15);
          b = Math.floor(38 - grad * 15);
        } else {
          // Inner Recessed Tier with Specular Highlight
          const innerEdge = dist / innerRadius;
          if (dist >= innerRadius * 0.92) {
            // Inner gold hairline
            r = 245; g = 158; b = 11;
          } else {
            // Core Ruby Red with 3D Depth
            r = Math.min(255, Math.floor(185 + (1 - innerEdge) * 60));
            g = 28;
            b = 28;

            // Crown Motif in the center
            const ny = (dy) / (innerRadius * 0.7);
            const nx = (dx) / (innerRadius * 0.7);
            
            // Central Crown geometry
            if (ny >= -0.35 && ny <= 0.35 && Math.abs(nx) <= 0.55) {
              const crownBottom = ny >= 0.15;
              const crownLeftPeak = Math.abs(nx + 0.35) < 0.12 && ny < 0.15 && ny > -0.3;
              const crownCenterPeak = Math.abs(nx) < 0.14 && ny < 0.15 && ny > -0.38;
              const crownRightPeak = Math.abs(nx - 0.35) < 0.12 && ny < 0.15 && ny > -0.3;
              const crownBody = ny >= -0.05 && ny <= 0.25;

              if (crownBottom || crownLeftPeak || crownCenterPeak || crownRightPeak || crownBody) {
                // Vibrant Brilliant Gold Crown
                r = 254; g = 240; b = 138;
              }
            }
          }
        }
      }

      rawData[offset++] = Math.max(0, Math.min(255, r));
      rawData[offset++] = Math.max(0, Math.min(255, g));
      rawData[offset++] = Math.max(0, Math.min(255, b));
      rawData[offset++] = Math.max(0, Math.min(255, a));
    }
  }

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk: width(4), height(4), bit depth(1: 8), color type(1: 6 = RGBA), compression(1: 0), filter(1: 0), interlace(1: 0)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // standard filter
  ihdr[12] = 0; // no interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatCompressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', idatCompressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 192x192 Standard
const p192 = createPng(192, 192, false);
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), p192);

// 512x512 Standard
const p512 = createPng(512, 512, false);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), p512);

// 192x192 Maskable
const pm192 = createPng(192, 192, true);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192x192.png'), pm192);

// 512x512 Maskable
const pm512 = createPng(512, 512, true);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512x512.png'), pm512);

console.log('Successfully generated PWA PNG icons in public/icons/');
