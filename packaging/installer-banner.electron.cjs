// Build-time format conversion only. Reuse the app banner; no new UI runtime or image dependency.
const { app, nativeImage } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
try {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Expected banner source and BMP destination');
  const image = nativeImage.createFromPath(source);
  if (image.isEmpty()) throw new Error('Installer banner could not be decoded');
  // Fill the portrait MUI sidebar, keeping the face centered and cropping the
  // sides rather than adding letterboxing or distorting the original artwork.
  const width = 164;
  const height = 314;
  const size = image.getSize();
  const scale = Math.max(width / size.width, height / size.height);
  const imageWidth = Math.max(width, Math.ceil(size.width * scale));
  const imageHeight = Math.max(height, Math.ceil(size.height * scale));
  const resized = image.resize({ width: imageWidth, height: imageHeight, quality: 'best' });
  const pixels = resized.toBitmap();
  // LoadImageW reliably accepts bottom-up 24-bit BMPs, unlike top-down 32-bit DIB files.
  const stride = (width * 3 + 3) & ~3;
  const output = Buffer.alloc(54 + stride * height);
  output.write('BM');output.writeUInt32LE(output.length, 2);output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);output.writeInt32LE(width, 18);output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);output.writeUInt16LE(24, 28);output.writeUInt32LE(stride * height, 34);
  const left = Math.floor((imageWidth - width) / 2);
  const top = Math.floor((imageHeight - height) / 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const targetOffset = 54 + (height - 1 - y) * stride + x * 3;
    const sourceOffset = ((y + top) * imageWidth + x + left) * 4;
    pixels.copy(output, targetOffset, sourceOffset, sourceOffset + 3);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, output);
  app.exit(0);
} catch (error) { console.error(error);app.exit(1); }
