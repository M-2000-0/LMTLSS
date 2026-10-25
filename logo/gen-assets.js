const sharp = require('sharp');
const path = require('path');

const MASTER_SVG = path.resolve(__dirname, 'lmtlss-logo.svg');

async function build() {
  await Promise.all([
    // Web share-card embed: matches sharecards.logo.svg / UI.logo() size
    sharp(MASTER_SVG)
      .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.resolve(__dirname, 'lmtlss-sharecard-embed.png')),

    // App icon: 1024x1024, centered pill on transparent canvas
    sharp(MASTER_SVG)
      .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.resolve(__dirname, 'lmtlss-icon-1024.png')),

    // Favicon: 48x48
    sharp(MASTER_SVG)
      .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.resolve(__dirname, 'lmtlss-favicon-48.png')),

    // Android adaptive-icon foreground: 1080x1080 safe-zone into a 432x432 icon
    sharp(MASTER_SVG)
      .resize(1080, 1080, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.resolve(__dirname, 'lmtlss-android-foreground-1080.png')),
  ]);

  console.log('done');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
