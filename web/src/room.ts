import "./styles.css";
import { fetchJoin } from "./api";
import { qs, setStatus } from "./ui";

import {
  Room,
  RoomEvent,
  Track,
  ParticipantEvent,
  TrackPublication,
  RemoteParticipant,
  LocalTrackPublication,
} from "livekit-client";

// DOM
const videosEl = qs<HTMLDivElement>("#videos");
const messagesEl = qs<HTMLDivElement>("#messages");
const countInfo = qs<HTMLDivElement>("#countInfo");
const whoamiEl = qs<HTMLDivElement>("#whoami");

const joinBtn = qs<HTMLButtonElement>("#joinBtn");
const leaveBtn = qs<HTMLButtonElement>("#leaveBtn");
const micBtn = qs<HTMLButtonElement>("#micBtn");
const camBtn = qs<HTMLButtonElement>("#camBtn");
const screenBtn = qs<HTMLButtonElement>("#screenBtn");

const roomInput = qs<HTMLInputElement>("#room");
const nameInput = qs<HTMLInputElement>("#name");
const roleSelect = qs<HTMLSelectElement>("#role");
const chatInput = qs<HTMLInputElement>("#chatText");
const sendBtn = qs<HTMLButtonElement>("#sendMsg");

// state
let room: Room | null = null;
let myName = "";
let myRoomName = "";
let myRole: "teacher" | "student" = "student";
let micOn = true;
let camOn = true;
let screenOn = false;

/* ---------------- helpers ---------------- */

function nowTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function addMessage(opts: { from: string; text: string; ts?: number; me?: boolean }) {
  const ts = opts.ts ?? Date.now();
  const wrap = document.createElement("div");
  wrap.className = "msg" + (opts.me ? " me" : "");

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${opts.from} • ${nowTime(ts)}`;

  const body = document.createElement("div");
  body.textContent = opts.text;

  wrap.appendChild(meta);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function enableControls(connected: boolean) {
  joinBtn.disabled = connected;
  leaveBtn.disabled = !connected;

  // teacher может публиковать
  const canPublish = connected && myRole === "teacher";
  micBtn.disabled = !canPublish;
  camBtn.disabled = !canPublish;
  screenBtn.disabled = !canPublish;
}

function resetUI() {
  videosEl.innerHTML = "";
  micOn = true;
  camOn = true;
  screenOn = false;
  micBtn.textContent = "Mic: ON";
  camBtn.textContent = "Cam: ON";
  screenBtn.textContent = "Share Screen";
  updateCount();
}

function updateCount() {
  const participants = room ? 1 + room.remoteParticipants.size : 0;
  countInfo.textContent = `Participants: ${participants}`;
}

function tileIdFor(identity: string, kind: "cam" | "screen" | "local") {
  return `tile__${identity}__${kind}`;
}

function ensureTile(identity: string, label: string, kind: "cam" | "screen" | "local") {
  const id = tileIdFor(identity, kind);
  let tile = document.getElementById(id) as HTMLDivElement | null;

  if (!tile) {
    tile = document.createElement("div");
    tile.className = "tile";
    tile.id = id;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = label;

    tile.appendChild(badge);
    videosEl.appendChild(tile);
  } else {
    const badge = tile.querySelector(".badge");
    if (badge) badge.textContent = label;
  }

  return tile;
}

function removeTile(identity: string, kind: "cam" | "screen" | "local") {
  const id = tileIdFor(identity, kind);
  document.getElementById(id)?.remove();
}

function attachVideoToTile(tile: HTMLElement, mediaEl: HTMLMediaElement) {
  tile.querySelectorAll("video,audio").forEach((v) => v.remove());
  mediaEl.autoplay = true;
  (mediaEl as any).playsInline = true;
  tile.appendChild(mediaEl);
}

function isScreenPublication(pub?: TrackPublication) {
  return (
    pub?.source === Track.Source.ScreenShare ||
    pub?.source === Track.Source.ScreenShareAudio
  );
}

/* ---------------- join logic ---------------- */

async function doJoin() {
  enableControls(false);
  setStatus("Requesting token...");

  myRoomName = roomInput.value.trim();
  myName = nameInput.value.trim();
  myRole = (roleSelect.value === "teacher" ? "teacher" : "student");

  if (!myRoomName || !myName) {
    setStatus("Room and Name are required");
    joinBtn.disabled = false;
    return;
  }

  whoamiEl.textContent = `${myName} @ ${myRoomName} (${myRole})`;

  let data;
  try {
    data = await fetchJoin(myRoomName, myName, myRole);
  } catch (e: any) {
    setStatus("API error: " + String(e?.message || e));
    joinBtn.disabled = false;
    return;
  }

  room = new Room({ adaptiveStream: true, dynacast: true });

  /* ---- room events ---- */

  room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
    addMessage({ from: "system", text: `${p.identity} joined`, ts: Date.now() });
    updateCount();
  });

  room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
    addMessage({ from: "system", text: `${p.identity} left`, ts: Date.now() });
    removeTile(p.identity, "cam");
    removeTile(p.identity, "screen");
    updateCount();
  });

  room.on(RoomEvent.TrackSubscribed, (track: Track, pub: TrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      const a = track.attach();
      a.autoplay = true;
      a.style.display = "none";
      document.body.appendChild(a);
      return;
    }

    const screen = isScreenPublication(pub);
    const kind = screen ? "screen" : "cam";
    const tile = ensureTile(
      participant.identity,
      `${participant.identity}${screen ? " (screen)" : ""}`,
      kind
    );

    const v = track.attach();
    attachVideoToTile(tile, v);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: Track, pub: TrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Video) {
      removeTile(participant.identity, isScreenPublication(pub) ? "screen" : "cam");
    }
    track.detach()?.forEach((el) => el.remove());
  });

  room.on(RoomEvent.DataReceived, (payload, participant) => {
    const text = new TextDecoder().decode(payload);
    try {
      const msg = JSON.parse(text);
      if (msg?.t === "chat") {
        addMessage({
          from: msg.from || participant?.identity || "unknown",
          text: msg.text || "",
          ts: msg.ts ?? Date.now(),
          me: false,
        });
        return;
      }
    } catch {}
    addMessage({ from: participant?.identity || "unknown", text, ts: Date.now() });
  });

  room.on(RoomEvent.Disconnected, () => {
    setStatus("Disconnected");
    resetUI();
    enableControls(false);
    joinBtn.disabled = false;
  });

  /* ---- connect ---- */

  setStatus("Connecting...");
  await room.connect(data.wsUrl, data.token);

  // ✅ teacher публикует сразу
  if (myRole === "teacher") {
    await room.localParticipant.setCameraEnabled(true);
    await room.localParticipant.setMicrophoneEnabled(true);
  }

  room.localParticipant.on(ParticipantEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
    const track = pub.track;
    if (!track || track.kind !== Track.Kind.Video) return;

    const kind = isScreenPublication(pub) ? "screen" : "local";
    const tile = ensureTile(
      "me",
      `${myName} (me)${kind === "screen" ? " (screen)" : ""}`,
      kind
    );

    const v = track.attach();
    v.muted = true;
    attachVideoToTile(tile, v);
  });

  enableControls(true);
  updateCount();
  setStatus("Connected ✅");

  if (myRole === "student") {
    addMessage({ from: "system", text: "You joined as student (view-only). Chat is enabled.", ts: Date.now() });
  } else {
    addMessage({ from: "system", text: "You joined as teacher. Camera/Mic enabled.", ts: Date.now() });
  }
}

/* ---------------- leave / controls ---------------- */

async function doLeave() {
  room?.disconnect();
  room = null;
  setStatus("Left room");
  resetUI();
  enableControls(false);
  joinBtn.disabled = false;
}

async function sendChat() {
  if (!room) return;
  const text = chatInput.value.trim();
  if (!text) return;

  room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify({ t: "chat", from: myName, ts: Date.now(), text })),
    { reliable: true }
  );

  addMessage({ from: myName, text, me: true });
  chatInput.value = "";
}

/* ---------------- UI bindings ---------------- */

joinBtn.onclick = () => void doJoin();
leaveBtn.onclick = () => void doLeave();

micBtn.onclick = async () => {
  if (!room || myRole !== "teacher") return;
  micOn = !micOn;
  await room.localParticipant.setMicrophoneEnabled(micOn);
  micBtn.textContent = `Mic: ${micOn ? "ON" : "OFF"}`;
};

camBtn.onclick = async () => {
  if (!room || myRole !== "teacher") return;
  camOn = !camOn;
  await room.localParticipant.setCameraEnabled(camOn);
  camBtn.textContent = `Cam: ${camOn ? "ON" : "OFF"}`;
  if (!camOn) removeTile("me", "local");
};

screenBtn.onclick = async () => {
  if (!room || myRole !== "teacher") return;
  screenOn = !screenOn;
  try {
    await room.localParticipant.setScreenShareEnabled(screenOn);
    screenBtn.textContent = screenOn ? "Stop Share" : "Share Screen";
  } catch {
    screenOn = false;
    screenBtn.textContent = "Share Screen";
    addMessage({ from: "system", text: "Screen share failed", ts: Date.now() });
  }
};

sendBtn.onclick = () => void sendChat();
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void sendChat();
});

// init
setStatus("Idle");
resetUI();
enableControls(false);
