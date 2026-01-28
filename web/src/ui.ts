// web/src/ui.ts

export function qs<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el as T;
}

export function getQueryParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Works with:
 * - new layout: <div id="statusText"></div>
 * - old layout: <div id="status"></div>
 */
export function setStatus(text: string) {
  const el =
    document.getElementById("statusText") ||
    document.getElementById("status");

  if (el) el.textContent = text;
}

/**
 * Creates a video tile compatible with your current room.html CSS
 */
export function createVideoTile(tileId: string, label: string) {
  const root = document.createElement("div");
  root.className = "tile";
  root.id = `tile-${tileId}`;

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = label;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  root.appendChild(badge);
  root.appendChild(video);

  return { root, video };
}

export function setTileLabel(tileId: string, label: string) {
  const root = document.getElementById(`tile-${tileId}`);
  if (!root) return;
  const badge = root.querySelector(".badge");
  if (badge) badge.textContent = label;
}

export function removeTile(tileId: string) {
  const el = document.getElementById(`tile-${tileId}`);
  if (el) el.remove();
}

/**
 * Attach LiveKit media element (<video> or <audio>) to tile
 */
export function attachMediaToTile(
  tileId: string,
  mediaEl: HTMLMediaElement
) {
  const tile = document.getElementById(`tile-${tileId}`);
  if (!tile) return;

  tile.querySelectorAll("video,audio").forEach((el) => el.remove());

  mediaEl.autoplay = true;
  (mediaEl as any).playsInline = true;
  mediaEl.style.width = "100%";
  mediaEl.style.height = "100%";
  mediaEl.style.objectFit = "cover";
  mediaEl.style.display = "block";

  tile.appendChild(mediaEl);
}
