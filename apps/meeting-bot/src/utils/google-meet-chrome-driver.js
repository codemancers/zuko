/* eslint-disable */
// =============================================================================
// google-meet-chrome-driver.js  —  Meeting bot browser-side driver
// =============================================================================

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Poll for a DOM element matching `selector`.
 * Returns the element, or null after maxAttempts × delayMs milliseconds.
 */
async function waitForElement(selector, maxAttempts = 30, delayMs = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/**
 * Collapse a multi-channel AudioData frame into a mono Float32Array.
 */
function downmixToMono(frame) {
  const n = frame.numberOfFrames;
  const ch = frame.numberOfChannels;
  const out = new Float32Array(n);
  if (ch === 1) {
    frame.copyTo(out, { planeIndex: 0 });
    return out;
  }
  const tmp = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    frame.copyTo(tmp, { planeIndex: c });
    for (let i = 0; i < n; i++) out[i] += tmp[i];
  }
  for (let i = 0; i < n; i++) out[i] /= ch;
  return out;
}

// ---------------------------------------------------------------------------
// Chat utility
// ---------------------------------------------------------------------------

async function dispatchChatMessage(text) {
  const findInput = () =>
    document.querySelector('textarea[aria-label="Send a message"]') ||
    document.querySelector('textarea[aria-label^="Send a message"]') ||
    document.querySelector('textarea[aria-label*="Send a message to"]');

  let input = findInput();

  if (!input) {
    const openBtn =
      document.querySelector('button[aria-label="Chat with everyone"]') ||
      document.querySelector('button[aria-label^="Chat with"]');
    if (!openBtn) return false;
    openBtn.click();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      input = findInput();
      if (input) break;
    }
  }

  if (!input) {
    console.error('[Driver] Chat input not found');
    return false;
  }

  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
    }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// MeetingUIManager  (UI & audio management)
// ---------------------------------------------------------------------------

class MeetingUIManager {
  constructor() {
    this._videoTrackMap = new Map();
    this._mainEl = null;
    this._audioCtx = null;
    this._audioTracks = [];
    this._silenceThreshold = 0.5;
    this._mixedAudioTrack = null;
    this._analyser = null;
    this._audioBuf = null;
    this._silenceTimer = null;
    this._memoryTimer = null;
    this._interactionTimer = null;
    this.unpinInterval = null;
  }

  addAudioTrack(track) {
    this._audioTracks.push(track);
  }

  addVideoTrack(trackEvent) {
    const sid = trackEvent.streams[0]?.id;
    const tid = trackEvent.track?.id;
    if (tid && sid) this._videoTrackMap.set(tid, sid);
  }

  // ---- periodic checks ----

  _monitorAudioLevel() {
    if (!this._analyser) return;
    this._analyser.getByteTimeDomainData(this._audioBuf);
    let s = 0;
    for (let i = 0; i < this._audioBuf.length; i++)
      s += Math.abs(this._audioBuf[i] - 128);
    const avg = s / this._audioBuf.length;
    if (avg > this._silenceThreshold) {
      window.ws.sendJson({
        type: 'SilenceStatus',
        volume: avg,
        isSilent: false,
      });
    }
  }

  _reportMemoryUsage() {
    window.ws.sendJson({
      type: 'MemoryUsage',
      memoryUsage: {
        jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory?.totalJSHeapSize,
        usedJSHeapSize: performance.memory?.usedJSHeapSize,
      },
    });
  }

  _handlePendingUIInteractions() {
    const modal = document.querySelector(
      'div[aria-modal="true"][role="dialog"]',
    );
    if (
      modal &&
      modal.textContent.includes('This video call is being recorded')
    ) {
      const ok = modal.querySelector('button[data-mdc-dialog-action="ok"]');
      if (ok) {
        try {
          ok.click();
          window.ws.sendJson({
            type: 'UiInteraction',
            message: 'Accepted recording notification',
          });
        } catch {
          window.ws.sendJson({
            type: 'Error',
            message: 'Failed to accept recording notification',
          });
        }
      } else {
        window.ws.sendJson({
          type: 'Error',
          message: 'Recording dialog: OK button not found',
        });
      }
    }

    const removedEl = document.querySelector('.roSPhc');
    if (
      removedEl &&
      (removedEl.textContent.includes("You've been removed from the meeting") ||
        removedEl.textContent.includes(
          'Your host ended the meeting for everyone',
        ))
    ) {
      window.ws.sendJson({
        type: 'MeetingStatusChange',
        change: 'removed_from_meeting',
      });
    }
  }

  _startTimers() {
    this._stopTimers();
    this._silenceTimer = setInterval(() => this._monitorAudioLevel(), 1000);
    this._memoryTimer = setInterval(() => this._reportMemoryUsage(), 60000);
    this._interactionTimer = setInterval(
      () => this._handlePendingUIInteractions(),
      5000,
    );
  }

  _stopTimers() {
    [this._silenceTimer, this._memoryTimer, this._interactionTimer].forEach(
      clearInterval,
    );
    this._silenceTimer = this._memoryTimer = this._interactionTimer = null;
  }

  // ---- audio graph ----

  _buildAudioGraph() {
    this._audioCtx = new AudioContext();
    const sources = this._audioTracks.map((t) =>
      this._audioCtx.createMediaStreamSource(new MediaStream([t])),
    );
    const dest = this._audioCtx.createMediaStreamDestination();
    sources.forEach((s) => s.connect(dest));

    this._analyser = this._audioCtx.createAnalyser();
    this._analyser.fftSize = 8192;
    this._audioBuf = new Uint8Array(this._analyser.frequencyBinCount);

    this._audioCtx.createMediaStreamSource(dest.stream).connect(this._analyser);
    this._mixedAudioTrack = dest.stream.getAudioTracks()[0];
  }

  async _streamMixedAudio() {
    try {
      const proc = new MediaStreamTrackProcessor({
        track: this._mixedAudioTrack,
      });
      const gen = new MediaStreamTrackGenerator({ kind: 'audio' });
      const abort = new AbortController();

      const passthrough = new TransformStream({
        async transform(frame, ctrl) {
          if (!frame) return;
          if (ctrl.desiredSize === null) {
            frame.close();
            return;
          }
          try {
            window.ws.sendMixedAudio(performance.now(), downmixToMono(frame));
            ctrl.enqueue(frame);
          } catch (e) {
            console.error('[Driver] Mixed audio error:', e);
            frame.close();
          }
        },
        flush() {
          console.log('[Driver] Mixed audio pipeline flushed');
        },
      });

      await proc.readable
        .pipeThrough(passthrough)
        .pipeTo(gen.writable, { signal: abort.signal })
        .catch((e) => {
          if (e.name !== 'AbortError')
            console.error('[Driver] Mixed audio pipeline error:', e);
        });
    } catch (e) {
      console.error('[Driver] _streamMixedAudio error:', e);
    }
  }

  startAudioProcessing() {
    this._buildAudioGraph();
    if (window.initialData.sendMixedAudio && this._mixedAudioTrack) {
      this._streamMixedAudio();
    }
    this._startTimers();
  }

  // ---- UI manipulation ----

  teardown() {
    this._restoreUI();
    if (this.unpinInterval) {
      clearInterval(this.unpinInterval);
      this.unpinInterval = null;
    }
    this._stopTimers();
  }

  _restoreUI() {
    document.querySelectorAll('body *').forEach((el) => {
      if (el.style.display !== 'none') return;
      const inMain =
        this._mainEl &&
        (this._mainEl === el ||
          this._mainEl.contains(el) ||
          el.contains(this._mainEl));
      if (!inMain) el.style.display = '';
    });
    console.log('[Driver] UI restored');
  }

  hideNonVideoUI() {
    try {
      this._mainEl = document.querySelector('main');
      if (!this._mainEl) {
        window.ws.sendJson({
          type: 'Error',
          message: 'No <main> element found',
        });
        return;
      }
      const ancestors = new Set();
      let p = this._mainEl.parentElement;
      while (p) {
        ancestors.add(p);
        p = p.parentElement;
      }
      document.querySelectorAll('body *').forEach((el) => {
        if (
          el !== this._mainEl &&
          !ancestors.has(el) &&
          !this._mainEl.contains(el)
        ) {
          el.style.display = 'none';
        }
      });
    } catch (e) {
      console.error('[Driver] hideNonVideoUI error:', e);
      window.ws.sendJson({
        type: 'Error',
        message: 'hideNonVideoUI failed: ' + e.message,
      });
    }
  }

  unpinAllPinnedVideos() {
    const list = document.querySelector(
      'div[aria-label="Participants"][role="list"]',
    );
    if (!list) return;
    for (const item of list.querySelectorAll('div[role="listitem"]')) {
      const pinned = Array.from(
        item.querySelectorAll('i[aria-hidden="true"]'),
      ).some((el) => el.textContent === 'keep');
      if (!pinned) continue;
      const btn = item.querySelector('button[aria-label="More actions"]');
      if (!btn) continue;
      btn.click();
      setTimeout(() => {
        const unpinItem = document.querySelector(
          'li[aria-label*="Unpin"][role="menuitem"]',
        );
        if (!unpinItem) return;
        unpinItem.click();
        window.ws.sendJson({
          type: 'UiInteraction',
          message: 'Unpinned video',
          dom: item.outerHTML,
        });
      }, 200);
    }
  }

  async _ensureParticipantListReady() {
    const btn = document.querySelector('button[aria-label="People"]');
    if (!btn) return;
    btn.click();
    const found = await waitForElement(
      'div[aria-label="Participants"][role="list"]',
    );
    if (!found)
      window.ws.sendJson({
        type: 'Error',
        message: 'Participant list did not appear',
      });
    btn.click();
  }

  async _ensureChatReady() {
    const btn = document.querySelector(
      'button[aria-label="Chat with everyone"]',
    );
    if (!btn) return;
    btn.click();
    const chatInput = await waitForElement(
      'textarea[aria-label="Send a message"]',
    );
    if (!chatInput) {
      window.ws.sendJson({
        type: 'Error',
        message: 'Chat input did not appear',
      });
      return;
    }
    btn.click();
    window.ws.sendJson({ type: 'ChatStatusChange', change: 'ready_to_send' });
  }

  async initializeMeetingSession() {
    if (window.initialData.recordingView === 'gallery_view') {
      await this._ensureParticipantListReady();
      await new Promise((r) => setTimeout(r, 500));
    }
    await this._ensureChatReady();
    this.hideNonVideoUI();
    if (window.initialData.recordingView === 'gallery_view') {
      this.unpinInterval = setInterval(() => this.unpinAllPinnedVideos(), 1000);
    }
    this.startAudioProcessing();
    console.log('[Driver] MeetingUIManager started');
  }
}

// ---------------------------------------------------------------------------
// VideoTrackRegistry
// ---------------------------------------------------------------------------

class VideoTrackRegistry {
  constructor() {
    this._tracks = new Map(); // trackId -> entry
    this._cached = null;
  }

  removeTrack(track) {
    this._tracks.delete(track.id);
    this._cached = null;
  }

  upsert(track, streamId, isScreenShare) {
    const prev = this._tracks.get(track.id);
    this._tracks.set(track.id, {
      track,
      streamId,
      isScreenShare,
      firstSeenAt: prev ? prev.firstSeenAt : Date.now(),
    });
    this._cached = null;
    console.log('[Driver] VideoTrack upserted', track.id);
  }

  getPrimaryStreamId() {
    return this._selectPrimaryTrack()?.streamId ?? null;
  }

  _selectPrimaryTrack() {
    if (this._cached) return this._cached;
    const all = Array.from(this._tracks.values());
    const ss = all.filter((t) => t.isScreenShare);
    if (ss.length) {
      this._cached = ss.reduce((a, b) =>
        a.firstSeenAt > b.firstSeenAt ? a : b,
      );
      return this._cached;
    }
    const reg = all.filter((t) => !t.isScreenShare);
    if (reg.length) {
      this._cached = reg.reduce((a, b) =>
        a.firstSeenAt > b.firstSeenAt ? a : b,
      );
      return this._cached;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// LiveCaptionHandler
// ---------------------------------------------------------------------------

class LiveCaptionHandler {
  constructor(ws) {
    this._ws = ws;
    this._seen = new Map();
  }

  processCaption(caption) {
    this._seen.set(caption.captionId, caption);
    this._ws.sendClosedCaptionUpdate(caption);
  }
}

// ---------------------------------------------------------------------------
// IncomingChatHandler
// ---------------------------------------------------------------------------

class IncomingChatHandler {
  constructor(ws) {
    this._ws = ws;
  }

  processMessage(rawWrapper) {
    try {
      const m = rawWrapper.chatMessage;
      console.log('[Driver] Incoming chat:', m);
      this._ws.sendJson({
        type: 'ChatMessage',
        message_uuid: m.messageId,
        participant_uuid: m.deviceId,
        timestamp: Math.floor(m.timestamp / 1000),
        text: m.chatMessageContent.text,
      });
    } catch (e) {
      console.error('[Driver] IncomingChatHandler error:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// ParticipantRegistry  (tracks users, device outputs, screen-share state)
// ---------------------------------------------------------------------------

const DEVICE_OUTPUT_KIND = { AUDIO: 1, VIDEO: 2 };

class ParticipantRegistry {
  constructor(ws) {
    this._ws = ws;
    this._all = new Map(); // deviceId -> user
    this._current = new Map(); // deviceId -> user (active snapshot)
    this._deviceOutputs = new Map(); // "deviceId-kind" -> output
    this._selfId = null;

    // kept for external compat
    this.MEETING_STATUS = { IN_MEETING: 1, NOT_IN_MEETING: 6 };
  }

  // ---- device outputs ----

  isStreamActive(streamId) {
    for (const o of this._deviceOutputs.values()) {
      if (o.streamId === streamId) return !o.disabled;
    }
    return false;
  }

  getDeviceOutput(deviceId, kind) {
    return this._deviceOutputs.get(`${deviceId}-${kind}`) ?? null;
  }

  syncDeviceOutputs(outputs) {
    for (const o of outputs) {
      this._deviceOutputs.set(`${o.deviceId}-${o.deviceOutputType}`, {
        deviceId: o.deviceId,
        outputType: o.deviceOutputType,
        streamId: o.streamId,
        disabled: o.deviceOutputStatus.disabled,
        lastUpdated: Date.now(),
      });
    }
    this._ws.sendJson({
      type: 'DeviceOutputsUpdate',
      deviceOutputs: Array.from(this._deviceOutputs.values()),
    });
  }

  // ---- lookups ----

  getByStreamId(streamId) {
    for (const o of this._deviceOutputs.values()) {
      if (o.streamId === streamId) return this._all.get(o.deviceId) ?? null;
    }
    return null;
  }

  getUserByStreamId(streamId) {
    return this.getByStreamId(streamId);
  }
  getUserByDeviceId(id) {
    return this._all.get(id) ?? null;
  }
  getUserByFullName(name) {
    return (
      Array.from(this._all.values()).find((u) => u.fullName === name) ?? null
    );
  }

  getCurrentUsersInMeeting() {
    return Array.from(this._current.values()).filter(
      (u) => u.status === this.MEETING_STATUS.IN_MEETING,
    );
  }

  getScreenSharingParticipants() {
    return this.getCurrentUsersInMeeting().filter((u) => !!u.parentDeviceId);
  }

  // ---- sync ----

  syncSingleParticipant(raw) {
    const merged = new Map([[raw.deviceId, raw]]);
    for (const [id, u] of this._current) if (!merged.has(id)) merged.set(id, u);
    this.syncParticipantList(Array.from(merged.values()));
  }

  syncParticipantList(rawList) {
    const LABELS = {
      1: 'in_meeting',
      6: 'not_in_meeting',
      7: 'removed_from_meeting',
    };

    const next = rawList.map((u) => {
      const { isCurrentUserString, ...rest } = u;
      if (isCurrentUserString && this._selfId === null)
        this._selfId = u.deviceId;
      return {
        ...rest,
        humanized_status: LABELS[u.status] ?? 'unknown',
        isCurrentUser: u.deviceId === this._selfId,
      };
    });

    const prevIds = new Set(this._current.keys());
    const nextIds = new Set(next.map((u) => u.deviceId));
    const updatedIds = new Set();

    for (const u of next) {
      if (
        prevIds.has(u.deviceId) &&
        JSON.stringify(this._current.get(u.deviceId)) !== JSON.stringify(u)
      ) {
        updatedIds.add(u.deviceId);
      }
      this._all.set(u.deviceId, {
        deviceId: u.deviceId,
        displayName: u.displayName,
        fullName: u.fullName,
        status: u.status,
        humanized_status: u.humanized_status,
        parentDeviceId: u.parentDeviceId,
        isCurrentUser: u.isCurrentUser,
      });
    }

    const added = next.filter((u) => !prevIds.has(u.deviceId));
    const removed = Array.from(prevIds)
      .filter((id) => !nextIds.has(id))
      .map((id) => this._current.get(id));

    this._current.clear();
    for (const u of next) {
      this._current.set(u.deviceId, {
        deviceId: u.deviceId,
        displayName: u.displayName,
        fullName: u.fullName,
        profilePicture: u.profilePicture,
        status: u.status,
        humanized_status: u.humanized_status,
        parentDeviceId: u.parentDeviceId,
        isCurrentUser: u.isCurrentUser,
      });
    }

    const updated = Array.from(updatedIds).map((id) => this._current.get(id));
    if (added.length || removed.length || updated.length) {
      this._ws.sendJson({
        type: 'UsersUpdate',
        newUsers: added,
        removedUsers: removed,
        updatedUsers: updated,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// RtpContributingSourceCache
// ---------------------------------------------------------------------------

class RtpContributingSourceCache {
  constructor() {
    this._map = new Map();
  }
  store(receiver, sources) {
    this._map.set(receiver, sources);
  }
  retrieve(receiver) {
    return this._map.get(receiver) ?? [];
  }
}

// ---------------------------------------------------------------------------
// RTCRtpReceiverInterceptor
// ---------------------------------------------------------------------------

class RTCRtpReceiverInterceptor {
  constructor(onContributingSources) {
    const orig = RTCRtpReceiver.prototype.getContributingSources;
    RTCRtpReceiver.prototype.getContributingSources = function () {
      const result = orig.apply(this, arguments);
      if (onContributingSources)
        onContributingSources(this, result, ...arguments);
      return result;
    };
  }
}

// ---------------------------------------------------------------------------
// BotSignalingSocket  (WebSocket wrapper with binary protocol)
// ---------------------------------------------------------------------------

class BotSignalingSocket {
  static MSG = {
    JSON: 1,
    VIDEO: 2,
    AUDIO: 3,
    MP4_CHUNK: 4,
    PER_PARTICIPANT_AUDIO: 5,
  };

  constructor() {
    const url = `ws://localhost:${window.initialData.websocketPort}`;
    console.log('[Driver] BotSignalingSocket →', url);
    this._sock = new WebSocket(url);
    this._sock.binaryType = 'arraybuffer';
    this._active = false;

    this._sock.onopen = () => console.log('[Driver] WebSocket connected');
    this._sock.onmessage = (e) => this._onMessage(e.data);
    this._sock.onerror = (e) => console.error('[Driver] WebSocket error:', e);
    this._sock.onclose = () => console.log('[Driver] WebSocket disconnected');
  }

  get isOpen() {
    return this._sock.readyState === WebSocket.OPEN;
  }

  async enableMediaSending() {
    this._active = true;
    await window.styleManager.initializeMeetingSession();
  }
  async disableMediaSending() {
    window.styleManager.teardown();
    await new Promise((r) => setTimeout(r, 2000));
    this._active = false;
  }

  _onMessage(data) {
    const type = new DataView(data).getInt32(0, true);
    if (type === BotSignalingSocket.MSG.JSON) {
      console.log(
        '[Driver] Received JSON:',
        JSON.parse(new TextDecoder().decode(new Uint8Array(data, 4))),
      );
    } else {
      console.warn('[Driver] Unknown WS message type:', type);
    }
  }

  sendJson(payload) {
    if (!this.isOpen) {
      console.error('[Driver] WS not open, dropping message');
      return;
    }
    try {
      const body = new TextEncoder().encode(JSON.stringify(payload));
      const buf = new Uint8Array(4 + body.length);
      new DataView(buf.buffer).setInt32(0, BotSignalingSocket.MSG.JSON, true);
      buf.set(body, 4);
      this._sock.send(buf.buffer);
    } catch (e) {
      console.error('[Driver] sendJson error:', e, payload);
    }
  }

  sendClosedCaptionUpdate(caption) {
    if (!this._active) return;
    this.sendJson({ type: 'CaptionUpdate', caption });
  }

  sendEncodedMP4Chunk(data) {
    if (!this.isOpen || !this._active) return;
    try {
      const hdr = new ArrayBuffer(4);
      new DataView(hdr).setInt32(0, BotSignalingSocket.MSG.MP4_CHUNK, true);
      this._sock.send(new Blob([hdr, data]));
    } catch (e) {
      console.error('[Driver] sendEncodedMP4Chunk error:', e);
    }
  }

  sendPerParticipantAudio(participantId, samples) {
    if (!this.isOpen || !this._active) return;
    try {
      const id = new TextEncoder().encode(participantId);
      const buf = new Uint8Array(4 + 1 + id.length + samples.buffer.byteLength);
      const dv = new DataView(buf.buffer);
      dv.setInt32(0, BotSignalingSocket.MSG.PER_PARTICIPANT_AUDIO, true);
      dv.setUint8(4, id.length);
      buf.set(id, 5);
      buf.set(new Uint8Array(samples.buffer), 5 + id.length);
      this._sock.send(buf.buffer);
    } catch (e) {
      console.error('[Driver] sendPerParticipantAudio error:', e);
    }
  }

  sendMixedAudio(timestamp, samples) {
    if (!this.isOpen || !this._active) return;
    try {
      const buf = new Uint8Array(4 + samples.buffer.byteLength);
      new DataView(buf.buffer).setInt32(0, BotSignalingSocket.MSG.AUDIO, true);
      buf.set(new Uint8Array(samples.buffer), 4);
      this._sock.send(buf.buffer);
    } catch (e) {
      console.error('[Driver] sendMixedAudio error:', e);
    }
  }

  sendVideo(tsMicros, streamId, width, height, pixels) {
    if (!this.isOpen || !this._active) return;
    try {
      const sid = new TextEncoder().encode(streamId);
      const buf = new Uint8Array(
        4 + 8 + 4 + sid.length + 4 + 4 + pixels.buffer.byteLength,
      );
      const dv = new DataView(buf.buffer);
      dv.setInt32(0, BotSignalingSocket.MSG.VIDEO, true);
      dv.setBigInt64(4, BigInt(tsMicros), true);
      dv.setInt32(12, sid.length, true);
      buf.set(sid, 16);
      const off = 16 + sid.length;
      dv.setInt32(off, width, true);
      dv.setInt32(off + 4, height, true);
      buf.set(new Uint8Array(pixels.buffer), off + 8);
      this._sock.send(buf.buffer);
    } catch (e) {
      console.error('[Driver] sendVideo error:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// NetworkRequestMonitor  (wraps window.fetch)
// ---------------------------------------------------------------------------

class NetworkRequestMonitor {
  constructor(onResponse) {
    const _orig = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await _orig.apply(window, args);
        await onResponse(res.clone());
        return res;
      } catch (e) {
        console.error('[Driver] fetch intercept error:', e);
        throw e;
      }
    };
  }
}

// ---------------------------------------------------------------------------
// PeerConnectionMonitor  (wraps RTCPeerConnection)
// ---------------------------------------------------------------------------

class PeerConnectionMonitor {
  constructor({
    onPeerConnectionCreate = () => {},
    onDataChannelCreate = () => {},
  } = {}) {
    const OrigRTC = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...args) {
      const pc = Reflect.construct(OrigRTC, args);
      onPeerConnectionCreate(pc);
      const _origDC = pc.createDataChannel.bind(pc);
      pc.createDataChannel = (label, opts) => {
        const dc = _origDC(label, opts);
        onDataChannelCreate(dc, pc);
        return dc;
      };
      return pc;
    };
  }
}

// ---------------------------------------------------------------------------
// Protobuf schema definitions
// ---------------------------------------------------------------------------

const PROTO_SCHEMA = [
  {
    name: 'CollectionEvent',
    fields: [
      {
        name: 'body',
        fieldNumber: 1,
        type: 'message',
        messageType: 'CollectionEventBody',
      },
    ],
  },
  {
    name: 'CollectionEventBody',
    fields: [
      {
        name: 'payload',
        fieldNumber: 2,
        type: 'message',
        messageType: 'CollectionPayloadWrapper',
      },
    ],
  },
  {
    name: 'CollectionPayloadWrapper',
    fields: [
      {
        name: 'deviceInfoWrapper',
        fieldNumber: 3,
        type: 'message',
        messageType: 'DeviceInfoWrapper',
      },
      {
        name: 'participantAndChatData',
        fieldNumber: 13,
        type: 'message',
        messageType: 'ParticipantAndChatData',
      },
    ],
  },
  {
    name: 'ParticipantAndChatData',
    fields: [
      {
        name: 'participantListWrapper',
        fieldNumber: 1,
        type: 'message',
        messageType: 'ParticipantListWrapper',
      },
      {
        name: 'chatMessageWrapper',
        fieldNumber: 4,
        type: 'message',
        messageType: 'ChatMessageWrapper',
        repeated: true,
      },
    ],
  },
  {
    name: 'DeviceInfoWrapper',
    fields: [
      {
        name: 'deviceOutputInfoList',
        fieldNumber: 2,
        type: 'message',
        messageType: 'DeviceOutputInfo',
        repeated: true,
      },
    ],
  },
  {
    name: 'DeviceOutputInfo',
    fields: [
      { name: 'deviceOutputType', fieldNumber: 2, type: 'varint' },
      { name: 'streamId', fieldNumber: 4, type: 'string' },
      { name: 'deviceId', fieldNumber: 6, type: 'string' },
      {
        name: 'deviceOutputStatus',
        fieldNumber: 10,
        type: 'message',
        messageType: 'DeviceOutputStatus',
      },
    ],
  },
  {
    name: 'DeviceOutputStatus',
    fields: [{ name: 'disabled', fieldNumber: 1, type: 'varint' }],
  },
  {
    name: 'ParticipantListResponse',
    fields: [
      {
        name: 'wrapper',
        fieldNumber: 2,
        type: 'message',
        messageType: 'ParticipantListWrapperWrapper',
      },
    ],
  },
  {
    name: 'ParticipantListWrapperWrapper',
    fields: [
      {
        name: 'participantListWrapper',
        fieldNumber: 2,
        type: 'message',
        messageType: 'ParticipantListWrapper',
      },
    ],
  },
  {
    name: 'ParticipantEventMeta',
    fields: [{ name: 'eventNumber', fieldNumber: 1, type: 'varint' }],
  },
  {
    name: 'ParticipantListWrapper',
    fields: [
      {
        name: 'eventMeta',
        fieldNumber: 1,
        type: 'message',
        messageType: 'ParticipantEventMeta',
      },
      {
        name: 'participants',
        fieldNumber: 2,
        type: 'message',
        messageType: 'ParticipantInfo',
        repeated: true,
      },
    ],
  },
  {
    name: 'ParticipantInfo',
    fields: [
      { name: 'deviceId', fieldNumber: 1, type: 'string' },
      { name: 'fullName', fieldNumber: 2, type: 'string' },
      { name: 'profilePicture', fieldNumber: 3, type: 'string' },
      { name: 'status', fieldNumber: 4, type: 'varint' }, // 1=in_meeting, 6=left, 7=removed
      { name: 'isCurrentUserString', fieldNumber: 7, type: 'string' }, // present only for the local user
      { name: 'displayName', fieldNumber: 29, type: 'string' },
      { name: 'parentDeviceId', fieldNumber: 21, type: 'string' }, // present for screen-share entries
    ],
  },
  {
    name: 'CaptionWrapper',
    fields: [
      {
        name: 'caption',
        fieldNumber: 1,
        type: 'message',
        messageType: 'Caption',
      },
    ],
  },
  {
    name: 'Caption',
    fields: [
      { name: 'deviceId', fieldNumber: 1, type: 'string' },
      { name: 'captionId', fieldNumber: 2, type: 'int64' },
      { name: 'version', fieldNumber: 3, type: 'int64' },
      { name: 'isFinal', fieldNumber: 4, type: 'varint' },
      { name: 'text', fieldNumber: 6, type: 'string' },
      { name: 'languageId', fieldNumber: 8, type: 'int64' },
    ],
  },
  {
    name: 'ChatMessageWrapper',
    fields: [
      {
        name: 'chatMessage',
        fieldNumber: 2,
        type: 'message',
        messageType: 'ChatMessage',
      },
    ],
  },
  {
    name: 'ChatMessage',
    fields: [
      { name: 'messageId', fieldNumber: 1, type: 'string' },
      { name: 'deviceId', fieldNumber: 2, type: 'string' },
      { name: 'timestamp', fieldNumber: 3, type: 'int64' },
      {
        name: 'chatMessageContent',
        fieldNumber: 5,
        type: 'message',
        messageType: 'ChatMessageContent',
      },
    ],
  },
  {
    name: 'ChatMessageContent',
    fields: [{ name: 'text', fieldNumber: 1, type: 'string' }],
  },
];

// ---------------------------------------------------------------------------
// Protobuf decoder factory
// ---------------------------------------------------------------------------

// Forward reference — decoderRegistry is populated after schema is defined.
let decoderRegistry = {};

function buildProtobufDecoder(schemaDef) {
  return function decode(input, byteLen) {
    const rdr =
      input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
    const end = byteLen === undefined ? rdr.len : rdr.pos + byteLen;
    const obj = {};

    while (rdr.pos < end) {
      const tag = rdr.uint32();
      const fieldNum = tag >>> 3;
      const field = schemaDef.fields.find((f) => f.fieldNumber === fieldNum);
      if (!field) {
        rdr.skipType(tag & 7);
        continue;
      }

      let val;
      switch (field.type) {
        case 'string':
          val = rdr.string();
          break;
        case 'int64':
          val = rdr.int64();
          break;
        case 'varint':
          val = rdr.uint32();
          break;
        case 'message':
          val = decoderRegistry[field.messageType](rdr, rdr.uint32());
          break;
        default:
          rdr.skipType(tag & 7);
          continue;
      }

      if (field.repeated) {
        if (!obj[field.name]) obj[field.name] = [];
        obj[field.name].push(val);
      } else {
        obj[field.name] = val;
      }
    }
    return obj;
  };
}

// ---------------------------------------------------------------------------
// Bootstrap — create singletons & wire up globals
// ---------------------------------------------------------------------------

const ws = new BotSignalingSocket();
window.ws = ws;

const participantRegistry = new ParticipantRegistry(ws);
const captionHandler = new LiveCaptionHandler(ws);
const videoRegistry = new VideoTrackRegistry();
const meetingUIManager = new MeetingUIManager();
const sourceCache = new RtpContributingSourceCache();
const incomingChatHandler = new IncomingChatHandler(ws);

if (window.initialData.sendPerParticipantAudio) {
  new RTCRtpReceiverInterceptor((receiver, result) =>
    sourceCache.store(receiver, result),
  );
}

// Expose globals expected by the rest of the codebase
window.userManager = participantRegistry; // compat alias
window.styleManager = meetingUIManager; // compat alias
window.videoTrackManager = videoRegistry; // compat alias
window.receiverManager = sourceCache; // compat alias
window.chatMessageManager = incomingChatHandler;
window.sendChatMessage = dispatchChatMessage;

// Build all decoders
PROTO_SCHEMA.forEach((def) => {
  decoderRegistry[def.name] = buildProtobufDecoder(def);
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Fetch intercept — participant list sync
// ---------------------------------------------------------------------------

const SYNC_COLLECTIONS_URL =
  'https://meet.google.com/$rpc/google.rtc.meetings.v1.MeetingSpaceService/SyncMeetingSpaceCollections';

new NetworkRequestMonitor(async (response) => {
  if (response.url !== SYNC_COLLECTIONS_URL) return;
  const bytes = base64ToBytes(await response.text());
  const parsed = decoderRegistry['ParticipantListResponse'](bytes);
  const list = parsed.wrapper?.participantListWrapper?.participants || [];
  console.log('[Driver] SyncMeetingSpaceCollections participants:', list);
  if (list.length > 0) participantRegistry.syncParticipantList(list);
});

// ---------------------------------------------------------------------------
// DataChannel handlers
// ---------------------------------------------------------------------------

function onCollectionDataReceived(event) {
  const raw = pako.inflate(new Uint8Array(event.data));
  const envelope = decoderRegistry['CollectionEvent'](raw);
  const payload = envelope.body?.payload;
  if (!payload) return;

  const deviceOutputs = payload.deviceInfoWrapper?.deviceOutputInfoList;
  if (deviceOutputs) participantRegistry.syncDeviceOutputs(deviceOutputs);

  const chatMessages = payload.participantAndChatData?.chatMessageWrapper;
  if (chatMessages) {
    for (const msg of chatMessages) incomingChatHandler.processMessage(msg);
  }

  const participants =
    payload.participantAndChatData?.participantListWrapper?.participants || [];
  console.log('[Driver] Collection event participants:', participants);
  for (const p of participants) participantRegistry.syncSingleParticipant(p);
}

function onCaptionDataReceived(event) {
  const wrapper = decoderRegistry['CaptionWrapper'](new Uint8Array(event.data));
  captionHandler.processCaption(wrapper.caption);
}

function onMediaDirectorDataReceived(event) {
  const raw = new Uint8Array(event.data);
  const b64 = btoa(String.fromCharCode(...raw));
  console.log('[Driver] Media director event (base64):', b64);
}

// ---------------------------------------------------------------------------
// Track pipelines
// ---------------------------------------------------------------------------

async function attachVideoFramePipeline(event) {
  try {
    const proc = new MediaStreamTrackProcessor({ track: event.track });
    const gen = new MediaStreamTrackGenerator({ kind: 'video' });
    const firstSid = event.streams[0]?.id;

    event.track.addEventListener('ended', () => {
      console.log('[Driver] Video track ended:', event.track.id);
      videoRegistry.removeTrack(event.track);
    });

    const isScreenShare = participantRegistry
      .getScreenSharingParticipants()
      .some(
        (u) =>
          firstSid &&
          participantRegistry.getDeviceOutput(
            u.deviceId,
            DEVICE_OUTPUT_KIND.VIDEO,
          )?.streamId === firstSid,
      );

    if (firstSid) videoRegistry.upsert(event.track, firstSid, isScreenShare);

    const fps = isScreenShare ? 5 : 15;
    const interval = 1000 / fps;
    let lastFrame = 0;
    const abort = new AbortController();

    const pipeline = new TransformStream({
      async transform(frame, ctrl) {
        if (!frame) return;
        if (ctrl.desiredSize === null) {
          frame.close();
          return;
        }
        try {
          const now = performance.now();
          if (firstSid && firstSid === videoRegistry.getPrimaryStreamId()) {
            if (now - lastFrame >= interval) {
              const raw = new VideoFrame(frame, { format: 'I420' });
              const pixels = new Uint8Array(raw.allocationSize());
              raw.copyTo(pixels);
              ws.sendVideo(
                BigInt(Math.floor(now * 1000)),
                firstSid,
                frame.displayWidth,
                frame.displayHeight,
                pixels,
              );
              raw.close();
              lastFrame = now;
            }
          }
          ctrl.enqueue(frame);
        } catch (e) {
          console.error('[Driver] Video frame error:', e);
          frame.close();
        }
      },
      flush() {
        console.log('[Driver] Video pipeline flushed');
      },
    });

    await proc.readable
      .pipeThrough(pipeline)
      .pipeTo(gen.writable, { signal: abort.signal })
      .catch((e) => {
        if (e.name !== 'AbortError')
          console.error('[Driver] Video pipeline error:', e);
      });
  } catch (e) {
    console.error('[Driver] attachVideoFramePipeline error:', e);
  }
}

async function attachAudioFramePipeline(event) {
  let lastFormatSig = null;
  try {
    const proc = new MediaStreamTrackProcessor({ track: event.track });
    const gen = new MediaStreamTrackGenerator({ kind: 'audio' });
    const receiver = event.receiver;
    const abort = new AbortController();

    const pipeline = new TransformStream({
      async transform(frame, ctrl) {
        if (!frame) return;
        if (ctrl.desiredSize === null) {
          frame.close();
          return;
        }
        try {
          const mono = downmixToMono(frame);

          // Notify on format change
          const fmt = {
            numberOfChannels: 1,
            originalNumberOfChannels: frame.numberOfChannels,
            numberOfFrames: frame.numberOfFrames,
            sampleRate: frame.sampleRate,
            format: frame.format,
            duration: frame.duration,
          };
          const fmtSig = JSON.stringify(fmt);
          if (fmtSig !== lastFormatSig) {
            lastFormatSig = fmtSig;
            ws.sendJson({ type: 'AudioFormatUpdate', format: fmt });
          }

          // Skip silence
          if (mono.every((v) => v === 0)) {
            ctrl.enqueue(frame);
            return;
          }

          // Attribute audio to loudest contributing source
          const sources = sourceCache.retrieve(receiver);
          const ranked = sources
            .map((s) => ({
              level: s?.audioLevel ?? 0,
              user: participantRegistry.getByStreamId(s.source.toString()),
            }))
            .filter((x) => x.user)
            .sort((a, b) => b.level - a.level);

          const loudest = ranked[0]?.user;
          if (loudest?.deviceId)
            ws.sendPerParticipantAudio(loudest.deviceId, mono);

          ctrl.enqueue(frame);
        } catch (e) {
          console.error('[Driver] Audio frame error:', e);
          frame.close();
        }
      },
      flush() {
        console.log('[Driver] Audio pipeline flushed');
      },
    });

    await proc.readable
      .pipeThrough(pipeline)
      .pipeTo(gen.writable, { signal: abort.signal })
      .catch((e) => {
        if (e.name !== 'AbortError')
          console.error('[Driver] Audio pipeline error:', e);
      });
  } catch (e) {
    console.error('[Driver] attachAudioFramePipeline error:', e);
  }
}

new PeerConnectionMonitor({
  onPeerConnectionCreate: (pc) => {
    pc.addEventListener('datachannel', (event) => {
      if (event.channel.label === 'collections') {
        event.channel.addEventListener('message', onCollectionDataReceived);
      }
    });

    pc.addEventListener('track', (event) => {
      if (event.track.kind === 'audio') {
        meetingUIManager.addAudioTrack(event.track);
        if (window.initialData && window.initialData.sendPerParticipantAudio) {
          attachAudioFramePipeline(event);
        }
      }
      if (event.track.kind === 'video') {
        meetingUIManager.addVideoTrack(event);
      }
    });
  },
  onDataChannelCreate: (dc, pc) => {
    if (dc.label === 'media-director') {
      dc.addEventListener('message', onMediaDirectorDataReceived);
    }
    if (
      dc.label === 'captions' &&
      window.initialData &&
      window.initialData.collectCaptions
    ) {
      dc.addEventListener('message', onCaptionDataReceived);
    }
  },
});

// ---------------------------------------------------------------------------
// BotAVOutputController (image/video/audio injection)
// ---------------------------------------------------------------------------

function attachClickRippleEffect() {
  document.addEventListener(
    'click',
    (e) => {
      if (!window.initialData?.addClickRipple) return;
      const ripple = document.createElement('div');
      Object.assign(ripple.style, {
        position: 'fixed',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        marginLeft: '-10px',
        marginTop: '-10px',
        background: 'red',
        opacity: '0',
        pointerEvents: 'none',
        transform: 'scale(0)',
        transition: 'transform 0.3s, opacity 0.3s',
        zIndex: '9999999',
        left: e.pageX + 'px',
        top: e.pageY + 'px',
      });
      document.body.appendChild(ripple);
      getComputedStyle(ripple).transform; // force reflow
      ripple.style.transform = 'scale(3)';
      ripple.style.opacity = '0.7';
      setTimeout(() => ripple.remove(), 300);
    },
    true,
  );
}

attachClickRippleEffect();

function clickLanguageOption(code) {
  const el = document.querySelector(`li[data-value="${code}"]`);
  if (!el) return false;
  el.click();
  return true;
}

async function turnOnCamera() {
  let btn = await waitForElement(
    'button[aria-label="Turn on camera"], div[aria-label="Turn on camera"]',
  );
  if (btn) btn.click();
  else
    window.ws.sendJson({ type: 'Error', message: 'Camera button not found' });
}

function turnOnMic() {
  const btn = document.querySelector('button[aria-label="Turn on microphone"]');
  if (btn) btn.click();
}

function turnOffMic() {
  const btn = document.querySelector(
    'button[aria-label="Turn off microphone"]',
  );
  if (btn) btn.click();
}

function turnOnMicAndCamera() {
  turnOnMic();
  const cam = document.querySelector('button[aria-label="Turn on camera"]');
  if (cam) cam.click();
}

function turnOffMicAndCamera() {
  turnOffMic();
  const cam = document.querySelector('button[aria-label="Turn off camera"]');
  if (cam) cam.click();
}

const _origGetUserMedia = navigator.mediaDevices.getUserMedia;

class BotAVOutputController {
  constructor() {
    this._videoEl = null;
    this._videoSrcNode = null;
    this._videoStream = null;

    this._canvasEl = null;
    this._canvasStream = null;
    this._lastImageB64 = null;
    this._drawInterval = null;

    this._audioCtx = null;
    this._gainNode = null;
    this._destNode = null;
    this._audioTrack = null;

    this._audioQueue = [];
    this._nextPlayTime = 0;
    this._isPlaying = false;
    this._sampleRate = 44100;
    this._channels = 1;
    this._micTimeout = null;
  }

  // ---- Video / Image output ----

  _connectVideoToAudio() {
    if (this._videoEl && this._audioCtx && !this._videoSrcNode) {
      this._videoSrcNode = this._audioCtx.createMediaElementSource(
        this._videoEl,
      );
      this._videoSrcNode.connect(this._gainNode);
    }
  }

  isVideoPlaying() {
    return !!this._videoEl;
  }

  playVideo(url) {
    turnOffMicAndCamera();
    if (this._videoSrcNode) {
      this._videoSrcNode.disconnect();
      this._videoSrcNode = null;
    }
    if (this._videoEl) {
      this._videoEl.remove();
    }

    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      style: 'display:none',
      src: url,
      crossOrigin: 'anonymous',
      loop: false,
      autoplay: true,
      muted: false,
    });

    this._videoEl.addEventListener(
      'playing',
      () => {
        console.log('[Driver] Bot video started');
        this._videoStream = this._videoEl.captureStream();
        turnOnMicAndCamera();
      },
      { once: true },
    );

    this._videoEl.addEventListener('ended', () => {
      turnOffMicAndCamera();
      if (this._videoSrcNode) {
        this._videoSrcNode.disconnect();
        this._videoSrcNode = null;
      }
      this._videoEl.remove();
      this._videoEl = this._videoStream = null;

      if (this._canvasStream) {
        this._canvasStream = null;
        if (this._lastImageB64)
          setTimeout(() => this.displayImage(this._lastImageB64), 1000);
      }
    });

    document.body.appendChild(this._videoEl);
  }

  async displayImage(bytes) {
    try {
      await this._renderImageToCanvas(bytes);
      if (this._canvasStream) return; // already active
      this._lastImageB64 = bytes;
      this._canvasStream = this._canvasEl.captureStream(1);
      await turnOnCamera();
    } catch (e) {
      console.error('[Driver] displayImage error:', e);
    }
  }

  _renderImageToCanvas(bytes) {
    if (!this._canvasEl) {
      this._canvasEl = document.createElement('canvas');
      this._canvasEl.width = 1280;
      this._canvasEl.height = 640;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        const ctx = this._canvasEl.getContext('2d');
        const cw = this._canvasEl.width,
          ch = this._canvasEl.height;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, cw, ch);

        const imgAsp = img.width / img.height;
        const cvsAsp = cw / ch;
        let rw = cw,
          rh = cw / imgAsp,
          ox = 0,
          oy = (ch - rh) / 2;
        if (imgAsp <= cvsAsp) {
          rh = ch;
          rw = ch * imgAsp;
          ox = (cw - rw) / 2;
          oy = 0;
        }

        if (this._drawInterval) clearInterval(this._drawInterval);
        const draw = () => ctx.drawImage(img, ox, oy, rw, rh);
        draw();
        this._drawInterval = setInterval(draw, 1000);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load bot image'));
      };
      img.src = url;
    });
  }

  // ---- Audio output ----

  _initAudio() {
    if (this._audioTrack) return;
    this._audioCtx = new AudioContext();
    this._gainNode = this._audioCtx.createGain();
    this._destNode = this._audioCtx.createMediaStreamDestination();
    this._gainNode.gain.value = 1.0;
    this._gainNode.connect(this._destNode);
    this._gainNode.connect(this._audioCtx.destination);
    this._audioTrack = this._destNode.stream.getAudioTracks()[0];
  }

  playPCMAudio(pcmData, rate = 44100, channels = 1) {
    turnOnMic();
    this._initAudio();
    if (this._sampleRate !== rate || this._channels !== channels) {
      this._sampleRate = rate;
      this._channels = channels;
    }

    const floats =
      pcmData instanceof Float32Array
        ? pcmData
        : new Float32Array(pcmData.length);
    if (!(pcmData instanceof Float32Array)) {
      for (let i = 0; i < pcmData.length; i++) floats[i] = pcmData[i] / 32768.0;
    }

    this._audioQueue.push({
      data: floats,
      duration: floats.length / (channels * rate),
    });
    if (!this._isPlaying) this._processAudioQueue();
  }

  _processAudioQueue() {
    if (this._audioQueue.length === 0) {
      this._isPlaying = false;
      if (this._micTimeout) clearTimeout(this._micTimeout);
      this._micTimeout = setTimeout(() => {
        if (this._audioQueue.length === 0) turnOffMic();
      }, 2000);
      return;
    }

    this._isPlaying = true;
    const now = this._audioCtx.currentTime;
    this._nextPlayTime = Math.max(now, this._nextPlayTime);

    const chunk = this._audioQueue.shift();
    const buf = this._audioCtx.createBuffer(
      this._channels,
      chunk.data.length / this._channels,
      this._sampleRate,
    );

    if (this._channels === 1) {
      buf.getChannelData(0).set(chunk.data);
    } else {
      for (let c = 0; c < this._channels; c++) {
        const cd = buf.getChannelData(c);
        for (let i = 0; i < chunk.data.length / this._channels; i++)
          cd[i] = chunk.data[i * this._channels + c];
      }
    }

    const src = this._audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this._gainNode);
    src.start(this._nextPlayTime);
    this._nextPlayTime += chunk.duration;

    setTimeout(
      () => this._processAudioQueue(),
      Math.max(0, (this._nextPlayTime - now) * 1000 * 0.8),
    );
  }

  // Called by getUserMedia interceptor
  buildBotMediaStream(constraints) {
    const stream = new MediaStream();
    if (constraints.video) {
      if (this._videoStream) {
        stream.addTrack(this._videoStream.getVideoTracks()[0]);
      } else if (this._canvasStream) {
        stream.addTrack(this._canvasStream.getVideoTracks()[0]);
      }
    }
    if (constraints.audio) {
      this._initAudio();
      stream.addTrack(this._audioTrack);
    }
    if (this._videoStream) this._connectVideoToAudio();
    return stream;
  }
}

const botOutputController = new BotAVOutputController();
window.botOutputManager = botOutputController; // compat alias

// ---------------------------------------------------------------------------
// getUserMedia interceptor
// ---------------------------------------------------------------------------

navigator.mediaDevices.getUserMedia = async function (constraints) {
  try {
    const realStream = await _origGetUserMedia.call(
      navigator.mediaDevices,
      constraints,
    );
    console.log('[Driver] Intercepted getUserMedia:', constraints);
    realStream.getTracks().forEach((t) => t.stop()); // Stop real hardware
    return botOutputController.buildBotMediaStream(constraints);
  } catch (err) {
    console.error('[Driver] getUserMedia override error:', err);
    throw err;
  }
};
