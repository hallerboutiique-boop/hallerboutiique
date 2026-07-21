import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, "mobile", "assets");

function iconSvg({ size, foreground = false, monochrome = false }) {
  const gold = monochrome ? "#FFFFFF" : "#F2C466";
  const background = foreground ? "none" : "url(#background)";
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
      <defs>
        <radialGradient id="background" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stop-color="#252018"/>
          <stop offset="56%" stop-color="#11100D"/>
          <stop offset="100%" stop-color="#050505"/>
        </radialGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${gold}"/>
          <stop offset="50%" stop-color="${monochrome ? gold : "#C88C25"}"/>
          <stop offset="100%" stop-color="${gold}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="220" fill="${background}"/>
      ${foreground ? "" : '<circle cx="512" cy="512" r="382" fill="none" stroke="#4D3818" stroke-width="8"/>'}
      <text x="512" y="590" text-anchor="middle" fill="url(#gold)" font-family="Georgia, Times New Roman, serif" font-size="330" font-style="italic" font-weight="600" letter-spacing="-42">HB</text>
      <path d="M330 682 H694" stroke="${gold}" stroke-width="12" stroke-linecap="round"/>
      ${foreground ? "" : `<text x="512" y="750" text-anchor="middle" fill="#C7A865" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" letter-spacing="15">ORDINI</text>`}
    </svg>
  `);
}

await Promise.all([
  sharp(iconSvg({ size: 1024 })).flatten({ background: "#090909" }).removeAlpha().png().toFile(path.join(output, "icon.png")),
  sharp(iconSvg({ size: 1024 })).flatten({ background: "#090909" }).removeAlpha().png().toFile(path.join(output, "splash-icon.png")),
  sharp(iconSvg({ size: 432 })).resize(432, 432).flatten({ background: "#090909" }).removeAlpha().png().toFile(path.join(output, "android-icon-background.png")),
  sharp(iconSvg({ size: 432, foreground: true })).resize(432, 432).png().toFile(path.join(output, "android-icon-foreground.png")),
  sharp(iconSvg({ size: 432, foreground: true, monochrome: true })).resize(432, 432).png().toFile(path.join(output, "android-icon-monochrome.png")),
  sharp(iconSvg({ size: 64 })).resize(64, 64).flatten({ background: "#090909" }).removeAlpha().png().toFile(path.join(output, "favicon.png")),
]);

console.log("Mobile icons generated in mobile/assets.");
