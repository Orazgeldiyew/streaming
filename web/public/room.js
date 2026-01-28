/* global LivekitClient */

(function () {
  const $ = (id) => document.getElementById(id);

  const statusEl = $("status");
  const roomLabel = $("roomLabel");
  const nameLabel = $("nameLabel");

  const localVideo = $("localVideo");
  const grid = $("grid");
  const tileHint = $("tileHint");
  const participantsEl = $("participants");
  const errorBox = $("errorBox");

  const btnMic = $("btnMic");
  const btnCam = $("btnCam");
  const btnScreen = $("btnScreen");
  const btnMuteAll = $("btnMuteAll");
  const btnLeave = $("btnLeave");
  const btnCopyLink = $("btnCopyLink");
  const btnReconnect = $("btnReconnect");
  const btnApply = $("btnApply");

  const roomInput = $("roomInput");
  const nameInput = $("nameInput");

  // LiveKit state
  /** @type {import('livekit-client').Room | any} */
  let lkRoom = null;
  let micEnabled = true;
  let camEnabled = true;
  let remoteAudioMuted = false;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setError(msg) {
    errorBox.textContent = msg || "";
  }

  function parseQuery() {
    const q = new URLSearchParams(window.location.search);
    const room = q.get("room") || "";
    const name = q.get("name") || "";
    return { room, name };
  }

  function updateLabels(room, name) {
    roomLabel.textContent = room || "-";
    nameLabel.textContent = name || "-";
    roomInput.value = room || "";
    nameInput.value = name || "";
  }

  function ensureLivekitLoaded() {
    if (!window.LivekitClient) {
      throw new Error("LiveKit client not loaded. Check /public/vendor/livekit-client.umd.js");
    }
  }

  async function joinToken(room, name) {
    const res = await fetch("/api/livekit/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, name }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`join token failed: ${res.status} ${t}`);
    }
    return await res.json(); // {room,name,token,wsUrl}
  }

  function clearRemoteTiles() {
    const tiles = Array.from(document.querySelectorAll(".tile.remote"));
    for (const t of tiles) t.remove();
  }

  function setHintVisible(visible) {
    tileHint.style.display = visible ? "flex" : "none";
  }

  function createRemoteTile(identity) {
    const wrap = document.createElement("div");
    wrap.className = "tile remote";
    wrap.id = `remote_${cssSafe(identity)}`;

    const head = document.createElement("div");
    head.className = "tileHeader";

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = "Remote";

    const small = document.createElement("span");
    small.className = "small";
    small.textContent = identity;

    head.appendChild(pill);
    head.appendChild(small);

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;

    wrap.appendChild(head);
    wrap.appendChild(video);

    grid.insertBefore(wrap, tileHint); // remote before hint
    return { wrap, video };
  }

  function cssSafe(s) {
    return (s || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function renderParticipants() {
    if (!lkRoom) {
      participantsEl.innerHTML = `<div class="muted">—</div>`;
      return;
    }
    const remotes = Array.from(lkRoom.remoteParticipants.values());
    if (remotes.length === 0) {
      participantsEl.innerHTML = `<div class="muted">No remote participants</div>`;
      return;
    }

    participantsEl.innerHTML = "";
    for (const p of remotes) {
      const row = document.createElement("div");
      row.className = "pRow";
      const left = document.createElement("div");
      left.textContent = p.identity || p.sid || "unknown";
      const right = document.createElement("div");
      right.className = "muted";
      right.textContent = "online";
      row.appendChild(left);
      row.appendChild(right);
      participantsEl.appendChild(row);
    }
  }

  async function connect(roomName, userName) {
    setError("");
    ensureLivekitLoaded();

    if (!roomName || !userName) {
      throw new Error("room and name are required (query string or inputs)");
    }

    updateLabels(roomName, userName);
    setStatus("requesting token…");

    const { token, wsUrl } = await joinToken(roomName, userName);

    // Disconnect if exists
    await disconnect();

    setStatus("connecting…");

    // UMD exports: LivekitClient.Room, LivekitClient.RoomEvent, LivekitClient.Track
    const { Room, RoomEvent, Track } = window.LivekitClient;

    lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    // ---- Events ----
    lkRoom
      .on(RoomEvent.Connected, async () => {
        setStatus("connected");
        renderParticipants();

        // publish local tracks
        await lkRoom.localParticipant.setMicrophoneEnabled(micEnabled);
        await lkRoom.localParticipant.setCameraEnabled(camEnabled);

        // attach local camera track to localVideo when published
        attachLocalVideo();
      })
      .on(RoomEvent.Disconnected, () => {
        setStatus("disconnected");
        clearRemoteTiles();
        renderParticipants();
        setHintVisible(true);
      })
      .on(RoomEvent.ParticipantConnected, () => {
        renderParticipants();
      })
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        // remove tile
        const id = `remote_${cssSafe(p.identity)}`;
        const t = document.getElementById(id);
        if (t) t.remove();
        renderParticipants();
        setHintVisible(lkRoom.remoteParticipants.size === 0);
      })
      .on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        const identity = participant.identity || participant.sid;
        let tile = document.getElementById(`remote_${cssSafe(identity)}`);

        if (!tile) {
          const made = createRemoteTile(identity);
          tile = made.wrap;
        }

        const videoEl = tile.querySelector("video");

        if (track.kind === Track.Kind.Video) {
          track.attach(videoEl);
          setHintVisible(false);
        } else if (track.kind === Track.Kind.Audio) {
          // audio track attaches to a hidden audio element
          const audioEl = track.attach();
          audioEl.autoplay = true;
          audioEl.dataset.remoteAudio = "1";
          if (remoteAudioMuted) audioEl.muted = true;
          tile.appendChild(audioEl);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        try { track.detach().forEach((el) => el.remove()); } catch (_) {}
      });

    // Connect to LiveKit
    await lkRoom.connect(wsUrl, token, {
      autoSubscribe: true,
    });
  }

  function attachLocalVideo() {
    if (!lkRoom) return;

    // Find a local video publication
    const pubs = Array.from(lkRoom.localParticipant.videoTrackPublications.values());
    const pub = pubs.find((p) => p.track);
    if (pub && pub.track) {
      try {
        pub.track.attach(localVideo);
      } catch (e) {
        // ignore
      }
    }
  }

  async function disconnect() {
    if (!lkRoom) return;
    try {
      lkRoom.disconnect();
    } catch (_) {}
    lkRoom = null;
    clearRemoteTiles();
    renderParticipants();
    setHintVisible(true);
    setStatus("idle");
  }

  // ---- UI handlers ----

  btnMic.addEventListener("click", async () => {
    micEnabled = !micEnabled;
    btnMic.textContent = `Mic: ${micEnabled ? "ON" : "OFF"}`;
    if (lkRoom) {
      try { await lkRoom.localParticipant.setMicrophoneEnabled(micEnabled); } catch (e) { setError(String(e)); }
    }
  });

  btnCam.addEventListener("click", async () => {
    camEnabled = !camEnabled;
    btnCam.textContent = `Cam: ${camEnabled ? "ON" : "OFF"}`;
    if (lkRoom) {
      try {
        await lkRoom.localParticipant.setCameraEnabled(camEnabled);
        attachLocalVideo();
      } catch (e) {
        setError(String(e));
      }
    }
  });

  btnScreen.addEventListener("click", async () => {
    if (!lkRoom) return setError("Not connected");
    try {
      // LiveKit has setScreenShareEnabled
      const enabled = lkRoom.localParticipant.isScreenShareEnabled;
      await lkRoom.localParticipant.setScreenShareEnabled(!enabled);
      btnScreen.textContent = !enabled ? "Stop screen" : "Share screen";
    } catch (e) {
      setError(String(e));
    }
  });

  btnMuteAll.addEventListener("click", () => {
    remoteAudioMuted = !remoteAudioMuted;
    btnMuteAll.textContent = remoteAudioMuted ? "Unmute remote audio" : "Mute remote audio";
    document.querySelectorAll("audio[data-remote-audio='1']").forEach((a) => {
      a.muted = remoteAudioMuted;
    });
  });

  btnLeave.addEventListener("click", async () => {
    await disconnect();
    // Optional: go landing
    window.location.href = "/"; // или "/landing"
  });

  btnCopyLink.addEventListener("click", async () => {
    const room = roomInput.value.trim();
    const name = nameInput.value.trim();
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    url.searchParams.set("name", name);
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("link copied");
      setTimeout(() => setStatus(lkRoom ? "connected" : "idle"), 1200);
    } catch (e) {
      setError("Clipboard blocked. Copy manually: " + url.toString());
    }
  });

  btnReconnect.addEventListener("click", async () => {
    const room = roomInput.value.trim();
    const name = nameInput.value.trim();
    try {
      await connect(room, name);
    } catch (e) {
      setError(String(e));
      setStatus("idle");
    }
  });

  btnApply.addEventListener("click", () => {
    const room = roomInput.value.trim();
    const name = nameInput.value.trim();
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    url.searchParams.set("name", name);
    window.location.href = url.toString();
  });

  // ---- Boot ----
  (async function boot() {
    const { room, name } = parseQuery();
    updateLabels(room, name);

    btnMic.textContent = `Mic: ${micEnabled ? "ON" : "OFF"}`;
    btnCam.textContent = `Cam: ${camEnabled ? "ON" : "OFF"}`;
    btnScreen.textContent = "Share screen";
    btnMuteAll.textContent = "Mute remote audio";

    if (room && name) {
      try {
        await connect(room, name);
      } catch (e) {
        setError(String(e));
        setStatus("idle");
      }
    } else {
      setStatus("idle");
      setHintVisible(true);
    }
  })();
})();
