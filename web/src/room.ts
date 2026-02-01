import { fetchJoin } from "./api";
import { createTile, attachMedia, qs, setStatus, unlockAudio } from "./ui";

import {
  Room,
  RoomEvent,
  Track,
  ParticipantEvent,
  TrackPublication,
  RemoteParticipant,
  LocalTrackPublication,
} from "livekit-client";

/* ---------------- DOM: render SPA ---------------- */

export function mountRoomPage() {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app");

  app.innerHTML = `
    <header>
      <label>Room:</label>
      <input id="room" />

      <label>Name:</label>
      <input id="name" value="Bek" />

      <label>Role:</label>
      <select id="role">
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
      </select>

      <label>Teacher key:</label>
      <input id="teacherKey" placeholder="(only for teacher)" />

      <button id="joinBtn">Join</button>
      <button id="micBtn" class="secondary" disabled>Mic: ON</button>
      <button id="camBtn" class="secondary" disabled>Cam: ON</button>
      <button id="screenBtn" class="secondary" disabled>Share Screen</button>
      <button id="leaveBtn" class="danger" disabled>Leave</button>
    </header>

    <div id="statusBar">
      <div id="statusText">Idle</div>
      <div class="small">
        <span id="countInfo">Participants: 0</span>
        &nbsp;•&nbsp;
        <span id="whoami"></span>
      </div>
    </div>

    <div id="main">
      <div id="videosWrap">
        <div id="videosHeader">
          <div>Classroom Feed</div>
          <div class="small">LiveKit</div>
        </div>
        <div id="videos"></div>
      </div>

      <div id="sidebar">
        <div id="chat">
          <div id="chatHeader">
            <div>Chat</div>
            <div class="small">Data (reliable)</div>
          </div>
          <div id="messages"></div>
          <div id="chatInput">
            <input id="chatText" placeholder="Type message…" />
            <button id="sendMsg">
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z"></path></svg>
            </button>
          </div>
        </div>

        <div id="participants">
          <div id="participantsHeader">
            <div>Participants</div>
            <div id="participantCount" class="small">0 members</div>
          </div>
          <div id="participantsContent">
            <!-- Participant list items will be injected here -->
          </div>
        </div>
      </div>
    </div>
  `;

  boot();
}

/* ---------------- state ---------------- */

let room: Room | null = null;

let myName = "";
let myRoomName = "";
let myRole: "teacher" | "student" = "student";
let teacherKey = "";

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

function addMessage(opts: {
  from: string;
  text: string;
  ts?: number;
  me?: boolean;
}) {
  const messagesEl = qs<HTMLDivElement>("#messages");
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

function updateCount() {
  const countInfo = qs<HTMLSpanElement>("#countInfo");
  const participants = room ? 1 + room.remoteParticipants.size : 0;
  countInfo.textContent = `Participants: ${participants}`;
}

function isScreenPublication(pub?: TrackPublication | LocalTrackPublication) {
  if (!pub) return false;
  if (
    pub.source === Track.Source.ScreenShare ||
    pub.source === Track.Source.ScreenShareAudio
  ) {
    return true;
  }
  const name = (pub.trackName || (pub.track as any)?.name || "").toLowerCase();
  if (name.includes("screen")) return true;

  if (
    pub instanceof LocalTrackPublication &&
    (pub.source as any) === "screen_share"
  ) {
    return true;
  }

  return false;
}

function updateParticipantsList() {
  const content = document.getElementById("participantsContent");
  const countEl = document.getElementById("participantCount");
  const r = room;
  if (!content || !r) return;

  const allParticipants = [
    r.localParticipant,
    ...Array.from(r.remoteParticipants.values()),
  ];

  if (countEl) {
    countEl.textContent = `${allParticipants.length} member${allParticipants.length === 1 ? "" : "s"}`;
  }

  content.innerHTML = allParticipants
    .map((p) => {
      const identity = p.identity || "Unknown";
      const isMe = p === r.localParticipant;
      let role = "student";
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        role = meta.role || "student";
      } catch (e) {
        console.warn("Failed to parse metadata", e);
      }

      const pubs = [...p.trackPublications.values()];
      const hasVideo = pubs.some(
        (pub) => pub.track?.kind === Track.Kind.Video && !pub.isMuted,
      );

      const statusIcon = hasVideo ? "📹" : "🎧";
      const roleLabel =
        role === "teacher" ? '<span class="teacher-badge">Teacher</span>' : "";

      return `
        <div class="participant-item ${isMe ? "me" : ""}">
          <div class="pi-avatar">${identity.charAt(0).toUpperCase()}</div>
          <div class="pi-info">
            <div class="pi-name">${identity}${isMe ? " (you)" : ""} ${roleLabel}</div>
            <div class="pi-status">${statusIcon} ${hasVideo ? "On Camera" : "Listening"}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function tileKey(identity: string, kind: "cam" | "screen" | "local") {
  return `tile__${identity}__${kind}`;
}

function ensureTile(
  identity: string,
  label: string,
  kind: "cam" | "screen" | "local",
  isTeacher?: boolean,
) {
  const videosEl = qs<HTMLDivElement>("#videos");
  const id = tileKey(identity, kind);
  let tile = document.getElementById(id);

  if (!tile) {
    tile = createTile(id, label);
    if (kind === "screen") {
      tile.classList.add("screen-tile");
    }
    if (isTeacher) {
      tile.classList.add("teacher-tile");
    }
    videosEl.appendChild(tile);
  } else {
    const badge = tile.querySelector(".badge");
    if (badge) badge.textContent = label;

    if (isTeacher) {
      tile.classList.add("teacher-tile");
    } else {
      tile.classList.remove("teacher-tile");
    }
  }

  return tile;
}

function removeTile(identity: string, kind: "cam" | "screen" | "local") {
  const id = tileKey(identity, kind);
  document.getElementById(id)?.remove();
}

function enableControls(connected: boolean) {
  const joinBtn = qs<HTMLButtonElement>("#joinBtn");
  const leaveBtn = qs<HTMLButtonElement>("#leaveBtn");
  const micBtn = qs<HTMLButtonElement>("#micBtn");
  const camBtn = qs<HTMLButtonElement>("#camBtn");
  const screenBtn = qs<HTMLButtonElement>("#screenBtn");

  joinBtn.disabled = connected;
  leaveBtn.disabled = !connected;
  micBtn.disabled = !connected;
  camBtn.disabled = !connected;
  screenBtn.disabled = !connected;
}

function updateMediaButtons() {
  const micBtn = qs<HTMLButtonElement>("#micBtn");
  const camBtn = qs<HTMLButtonElement>("#camBtn");
  const screenBtn = qs<HTMLButtonElement>("#screenBtn");

  micBtn.textContent = micOn ? "Mic: ON" : "Mic: OFF";
  micBtn.classList.remove("active", "inactive");
  micBtn.classList.add(micOn ? "active" : "inactive");

  camBtn.textContent = camOn ? "Cam: ON" : "Cam: OFF";
  camBtn.classList.remove("active", "inactive");
  camBtn.classList.add(camOn ? "active" : "inactive");

  screenBtn.textContent = screenOn ? "Stop Share" : "Share Screen";
  screenBtn.classList.remove("active", "inactive");
  screenBtn.classList.add(screenOn ? "active" : "inactive");
}

function resetUI() {
  const videosEl = qs<HTMLDivElement>("#videos");
  videosEl.innerHTML = "";

  micOn = true;
  camOn = true;
  screenOn = false;

  updateMediaButtons();

  const screenBtn = qs<HTMLButtonElement>("#screenBtn");
  screenBtn.textContent = "Share Screen";

  updateParticipantsList();
  updateCount();
}

/* ---------------- core ---------------- */

async function doJoin() {
  enableControls(false);
  qs<HTMLButtonElement>("#joinBtn").disabled = true;
  setStatus("Requesting token...");

  // ✅ unlock audio by user gesture
  await unlockAudio();

  const roomInput = qs<HTMLInputElement>("#room");
  const nameInput = qs<HTMLInputElement>("#name");
  const roleSelect = qs<HTMLSelectElement>("#role");
  const teacherKeyInput = qs<HTMLInputElement>("#teacherKey");

  myRoomName = roomInput.value.trim();
  myName = nameInput.value.trim();
  myRole = roleSelect.value === "teacher" ? "teacher" : "student";
  teacherKey = teacherKeyInput.value.trim();

  if (!myRoomName || !myName) {
    setStatus("Room and Name are required");
    enableControls(false);
    qs<HTMLButtonElement>("#joinBtn").disabled = false;
    return;
  }

  const whoami = qs<HTMLSpanElement>("#whoami");
  whoami.textContent = `${myName} @ ${myRoomName} (${myRole})`;

  let data;
  try {
    data = await fetchJoin(myRoomName, myName, myRole, teacherKey);
  } catch (e: any) {
    setStatus("API error: " + String(e?.message || e));
    enableControls(false);
    return;
  }

  // сервер может вернуть student даже если просили teacher
  myRole = data.role;

  room = new Room({ adaptiveStream: true, dynacast: true });

  /* ---- events ---- */

  room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
    addMessage({ from: "system", text: `${p.identity} joined` });
    updateParticipantsList();
    updateCount();
  });

  room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
    addMessage({ from: "system", text: `${p.identity} left` });
    removeTile(p.identity, "cam");
    removeTile(p.identity, "screen");
    updateParticipantsList();
    updateCount();
  });

  room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
    if (track.kind === Track.Kind.Audio) {
      const a = track.attach();
      a.autoplay = true;
      (a as any).playsInline = true;
      a.style.display = "none";
      document.body.appendChild(a);
      return;
    }

    const kind: "cam" | "screen" = isScreenPublication(pub) ? "screen" : "cam";
    const meta = participant.metadata ? JSON.parse(participant.metadata) : {};
    const isTeacher = meta.role === "teacher";

    const tile = ensureTile(
      participant.identity,
      `${participant.identity}${kind === "screen" ? " (screen)" : ""}`,
      kind,
      isTeacher,
    );

    const v = track.attach();
    attachMedia(tile, v);
    updateParticipantsList();
  });

  room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
    if (track.kind === Track.Kind.Video) {
      removeTile(
        participant.identity,
        isScreenPublication(pub) ? "screen" : "cam",
      );
    }
    try {
      track.detach()?.forEach((el) => el.remove());
    } catch {}
    updateParticipantsList();
  });

  room.on(RoomEvent.TrackMuted, (pub, participant) => {
    if (pub.kind === Track.Kind.Video) {
      const kind: "cam" | "screen" = isScreenPublication(pub)
        ? "screen"
        : "cam";
      removeTile(participant.identity, kind);
    }
    updateParticipantsList();
  });

  room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
    if (pub.kind === Track.Kind.Video && pub.track) {
      const kind: "cam" | "screen" = isScreenPublication(pub)
        ? "screen"
        : "cam";
      const meta = participant.metadata ? JSON.parse(participant.metadata) : {};
      const isTeacher = meta.role === "teacher";

      const identity = participant.identity;
      const label = `${identity}${kind === "screen" ? " (screen)" : ""}`;

      const tile = ensureTile(identity, label, kind, isTeacher);
      const video = pub.track.attach();
      attachMedia(tile, video);
    }
    updateParticipantsList();
  });

  room.on(RoomEvent.DataReceived, (payload, participant) => {
    const raw = new TextDecoder().decode(payload);

    try {
      const msg = JSON.parse(raw);
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

    addMessage({ from: participant?.identity || "unknown", text: raw });
  });

  room.on(RoomEvent.Disconnected, () => {
    setStatus("Disconnected");
    resetUI();
    enableControls(false);
    qs<HTMLButtonElement>("#joinBtn").disabled = false;
  });

  /* ---- connect ---- */

  setStatus("Connecting...");
  try {
    await room.connect(data.wsUrl, data.token);
  } catch (e: any) {
    setStatus("Connect error: " + String(e?.message || e));
    qs<HTMLButtonElement>("#joinBtn").disabled = false;
    return;
  }

  /* ---- local publish ---- */

  room.localParticipant.on(
    ParticipantEvent.LocalTrackPublished,
    (pub: LocalTrackPublication) => {
      const track = pub.track;
      if (!track || track.kind !== Track.Kind.Video) return;

      const kind: "local" | "screen" = isScreenPublication(pub)
        ? "screen"
        : "local";
      const isTeacher = myRole === "teacher";

      const tile = ensureTile(
        "me",
        `${myName} (me)${kind === "screen" ? " (screen)" : ""}`,
        kind,
        isTeacher,
      );

      const v = track.attach();
      v.muted = true;
      attachMedia(tile, v);
      updateParticipantsList();
    },
  );

  room.localParticipant.on(ParticipantEvent.TrackMuted, (pub) => {
    if (pub.kind === Track.Kind.Video) {
      const kind: "local" | "screen" = isScreenPublication(pub)
        ? "screen"
        : "local";
      removeTile("me", kind);
    }
    updateParticipantsList();
  });

  room.localParticipant.on(ParticipantEvent.TrackUnmuted, (pub) => {
    if (pub.kind === Track.Kind.Video && pub.track) {
      const kind: "local" | "screen" = isScreenPublication(pub)
        ? "screen"
        : "local";
      const isTeacher = myRole === "teacher";
      const tile = ensureTile(
        "me",
        `${myName} (me)${kind === "screen" ? " (screen)" : ""}`,
        kind,
        isTeacher,
      );
      const v = pub.track.attach();
      v.muted = true;
      attachMedia(tile, v);
    }
    updateParticipantsList();
  });

  room.localParticipant.on(
    ParticipantEvent.LocalTrackUnpublished,
    (pub: LocalTrackPublication) => {
      const kind: "local" | "screen" = isScreenPublication(pub)
        ? "screen"
        : "local";
      removeTile("me", kind);
    },
  );

  setStatus("Enabling camera/mic...");
  try {
    await room.localParticipant.setCameraEnabled(true);
    await room.localParticipant.setMicrophoneEnabled(true);
  } catch (e: any) {
    addMessage({
      from: "system",
      text: `Media error: ${String(e?.message || e)}`,
    });
  }

  enableControls(true);
  updateMediaButtons();
  updateParticipantsList();
  updateCount();
  setStatus("Connected ✅");

  addMessage({
    from: "system",
    text:
      myRole === "teacher"
        ? "You joined as TEACHER. Controls enabled."
        : "You joined as STUDENT. Controls enabled.",
  });
}

async function doLeave() {
  room?.disconnect();
  room = null;
  setStatus("Left room");
  resetUI();
  enableControls(false);
  qs<HTMLButtonElement>("#joinBtn").disabled = false;
}

function sendChat() {
  if (!room) return;

  const input = qs<HTMLInputElement>("#chatText");
  const text = (input.value || "").trim();
  if (!text) return;

  const payload = JSON.stringify({
    t: "chat",
    from: myName,
    ts: Date.now(),
    text,
  });

  // ✅ правильный вариант для новых livekit-client
  room.localParticipant.publishData(new TextEncoder().encode(payload), {
    reliable: true,
  });

  addMessage({ from: myName, text, me: true });
  input.value = "";
  input.focus();
}

/* ---------------- boot ---------------- */

function boot() {
  const joinBtn = qs<HTMLButtonElement>("#joinBtn");
  const leaveBtn = qs<HTMLButtonElement>("#leaveBtn");
  const sendBtn = qs<HTMLButtonElement>("#sendMsg");
  const chatInput = qs<HTMLInputElement>("#chatText");

  joinBtn.onclick = () => void doJoin();
  leaveBtn.onclick = () => void doLeave();
  sendBtn.onclick = () => sendChat();
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });

  const micBtn = qs<HTMLButtonElement>("#micBtn");
  const camBtn = qs<HTMLButtonElement>("#camBtn");
  const screenBtn = qs<HTMLButtonElement>("#screenBtn");

  micBtn.onclick = async () => {
    if (!room) return;
    micOn = !micOn;
    await room.localParticipant.setMicrophoneEnabled(micOn);
    updateMediaButtons();
  };

  camBtn.onclick = async () => {
    if (!room) return;
    camOn = !camOn;
    await room.localParticipant.setCameraEnabled(camOn);
    updateMediaButtons();
  };

  screenBtn.onclick = async () => {
    if (!room) return;

    if (!window.isSecureContext) {
      addMessage({
        from: "system",
        text: "Screen sharing requires a secure context (HTTPS or localhost).",
      });
      return;
    }

    screenOn = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(screenOn);
      updateMediaButtons();
    } catch (e: any) {
      console.error("Screen share error:", e);
      screenOn = false;
      updateMediaButtons();

      let errorMsg = "Screen share failed";
      if (e?.name === "NotAllowedError") {
        errorMsg = "Screen share permission denied by user.";
      } else if (e?.name === "NotFoundError") {
        errorMsg = "Screen sharing is not supported on this device/browser.";
      } else if (e?.message) {
        errorMsg = `Screen share failed: ${e.message}`;
      }

      addMessage({ from: "system", text: errorMsg });
    }
  };

  setStatus("Idle");
  resetUI();
  enableControls(false);

  // Pre-fill room from URL: /join/class1
  const match = window.location.pathname.match(/^\/join\/([^/]+)$/);
  if (match?.[1]) {
    qs<HTMLInputElement>("#room").value = decodeURIComponent(match[1]);
  }
}
