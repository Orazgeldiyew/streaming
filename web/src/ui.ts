export function qs<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el as T;
}

export function setStatus(text: string) {
  const el =
    document.getElementById("statusText") ||
    document.getElementById("statusBar") ||
    document.getElementById("status");

  if (el) el.textContent = text;
}

export function createTile(id: string, label: string) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.id = id;

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = label;

  tile.appendChild(badge);
  return tile;
}

export function setTileLabel(tile: HTMLElement, label: string) {
  const badge = tile.querySelector(".badge");
  if (badge) badge.textContent = label;
}

export function attachMedia(tile: HTMLElement, media: HTMLMediaElement) {
  tile.querySelectorAll("video,audio").forEach((el) => el.remove());

  media.autoplay = true;
  (media as any).playsInline = true; // ✅ TS-safe
  media.style.width = "100%";
  media.style.height = "100%";
  media.style.objectFit = "cover";
  media.style.display = "block";

  tile.appendChild(media);
}

/**
 * ✅ Fix for Chrome autoplay policies:
 * create & play a silent audio once after user gesture (Join click).
 */
export async function unlockAudio(): Promise<void> {
  try {
    const a = document.createElement("audio");
    a.muted = true;
    a.autoplay = true;
    a.src =
      "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA" +
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    await a.play().catch(() => {});
    a.remove();
  } catch {}
}
