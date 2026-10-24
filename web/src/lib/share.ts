import { petSvg } from "./pet";

export interface StoryContent {
  kicker: string;
  emoji: string;
  title: string;
  subtitle: string;
  badge?: string;
  petLevel: number;
  petEquipped: string[];
}

const W = 1080;
const H = 1920;

function loadSvg(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderStory(c: StoryContent): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#d9eeea");
  bg.addColorStop(0.55, "#fdf3e7");
  bg.addColorStop(1, "#fde1d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (const [x, y, r] of [
    [140, 260, 90],
    [940, 420, 120],
    [120, 1500, 110],
    [980, 1700, 80],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#24324a";
  ctx.font = "800 64px Nunito, system-ui, sans-serif";
  ctx.fillText(c.kicker, W / 2, 260);

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(36,50,74,0.12)";
  ctx.shadowBlur = 40;
  roundRect(ctx, 90, 340, W - 180, 900, 80);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#fde8d4";
  ctx.beginPath();
  ctx.arc(W / 2, 560, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "200px 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(c.emoji, W / 2, 575);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#24324a";
  ctx.font = "800 84px Nunito, system-ui, sans-serif";
  let y = 860;
  for (const line of wrap(ctx, c.title, W - 300)) {
    ctx.fillText(line, W / 2, y);
    y += 96;
  }
  ctx.fillStyle = "rgba(36,50,74,0.65)";
  ctx.font = "600 46px Nunito, system-ui, sans-serif";
  for (const line of wrap(ctx, c.subtitle, W - 320)) {
    ctx.fillText(line, W / 2, y + 10);
    y += 60;
  }
  if (c.badge) {
    ctx.font = "800 48px Nunito, system-ui, sans-serif";
    const w = ctx.measureText(c.badge).width + 80;
    ctx.fillStyle = "#d9eeea";
    roundRect(ctx, W / 2 - w / 2, 1120, w, 84, 42);
    ctx.fill();
    ctx.fillStyle = "#2fb38f";
    ctx.fillText(c.badge, W / 2, 1178);
  }

  const pet = await loadSvg(petSvg(c.petLevel, c.petEquipped));
  ctx.drawImage(pet, W / 2 - 230, 1280, 460, 474);

  ctx.font = "800 56px Nunito, system-ui, sans-serif";
  ctx.textAlign = "left";
  const w1 = ctx.measureText("nutri").width;
  const start = W / 2 - (w1 + ctx.measureText(".ia").width) / 2;
  ctx.fillStyle = "#24324a";
  ctx.fillText("nutri", start, 1840);
  ctx.fillStyle = "#2fb38f";
  ctx.fillText(".ia", start + w1, 1840);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
      "image/png",
    ),
  );
}

export async function shareStory(
  c: StoryContent,
): Promise<"shared" | "downloaded"> {
  const blob = await renderStory(c);
  const file = new File([blob], "nutri-ia-conquista.png", {
    type: "image/png",
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
      throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
