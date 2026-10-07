import { usePlayerStore } from "../store/playerStore";

// Opt-in diagnostics for problems that only show up on one device (like a phone whose audio
// engine behaves differently). Open the app with ?debug on the end of the address to turn it
// on — it stays on until you open it with ?nodebug. Off by default; costs nothing when off.
const params = new URLSearchParams(window.location.search);
try {
  if (params.has("nodebug")) localStorage.removeItem("wv_debug");
  else if (params.has("debug")) localStorage.setItem("wv_debug", "1");
} catch {
  // storage blocked — ?debug still works for this page load via the check below
}
export const debugEnabled = params.has("debug") || (() => {
  try { return localStorage.getItem("wv_debug") === "1" && !params.has("nodebug"); } catch { return false; }
})();

const MAX_LINES = 90;
let lines = [];
const listeners = new Set();

export function debugLog(message) {
  if (!debugEnabled) return;
  lines = [...lines.slice(-(MAX_LINES - 1)), `${(performance.now() / 1000).toFixed(1)}s ${message}`];
  listeners.forEach((l) => l());
}
export const subscribeDebug = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getDebugLines = () => lines;
export function clearDebug() {
  lines = [];
  listeners.forEach((l) => l());
}

const shortUrl = (u) => String(u || "").replace(/^https?:\/\/[^/]+/, "").replace(/^blob:.*/, "blob:…").slice(0, 60);
const MEDIA_EVENTS = ["loadstart", "loadedmetadata", "durationchange", "canplay", "canplaythrough", "playing", "pause", "waiting", "stalled", "seeking", "ended", "error"];

function watchMedia(el) {
  if (el.__debugWatched) return;
  el.__debugWatched = true;
  for (const name of MEDIA_EVENTS) {
    el.addEventListener(name, () => {
      let extra = ` t=${el.currentTime.toFixed(1)} dur=${el.duration}`;
      if (name === "error") extra += ` code=${el.error?.code} ${el.error?.message || ""}`;
      debugLog(`audio ${name}${extra}`);
    });
  }
}

export function installDebug() {
  if (!debugEnabled) return;

  debugLog(`UA: ${navigator.userAgent}`);
  const probe = document.createElement("audio");
  const types = { mp3: "audio/mpeg", "m4a(aac)": 'audio/mp4; codecs="mp4a.40.2"', webm: 'audio/webm; codecs="opus"' };
  debugLog("can play: " + Object.entries(types).map(([n, t]) => `${n}=${probe.canPlayType(t) || "no"}`).join(" "));

  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    watchMedia(this);
    debugLog(`play() ${shortUrl(this.currentSrc || this.src)}`);
    const result = originalPlay.apply(this, args);
    result?.catch?.((e) => debugLog(`play() REJECTED: ${e.name}: ${e.message}`));
    return result;
  };

  // Who is pausing the audio? A stack trace at every pause() call answers that directly.
  const originalPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function (...args) {
    const who = new Error().stack.split("\n").slice(2, 7).map((l) => l.trim().replace(/^at /, "").replace(/\(?https?:\/\/[^/]+/, "(").replace(/\?v=\w+/g, "").slice(0, 70)).join(" ← ");
    debugLog(`pause() called by: ${who}`);
    return originalPause.apply(this, args);
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__debug = `${method} ${shortUrl(url)}`;
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const started = performance.now();
    this.addEventListener("loadend", () => debugLog(`${this.__debug} → ${this.status || "failed"} (${Math.round(performance.now() - started)}ms)`));
    return send.call(this, body);
  };

  window.addEventListener("error", (e) => debugLog(`JS error: ${e.message}`));
  window.addEventListener("unhandledrejection", (e) => debugLog(`unhandled: ${e.reason?.message || e.reason}`));

  // Every change of song — a skip-chain shows up here as rapid one-after-another entries
  usePlayerStore.subscribe((state, prev) => {
    const song = state.queue[state.currentIndex];
    const before = prev.queue[prev.currentIndex];
    if (song?.queueKey !== before?.queueKey) {
      debugLog(`SONG → #${state.currentIndex} "${song?.title}" (playing=${state.playing})`);
    }
    if (state.playing !== prev.playing) {
      // Skip zustand's own frames so the line names whoever actually asked for the change
      const callers = new Error().stack.split("\n").slice(2).filter((l) => !/zustand|Set\.forEach|setState/.test(l)).slice(0, 4);
      debugLog(`playing → ${state.playing}  (${callers.map((l) => l.trim().replace(/^at /, "").replace(/https?:\/\/[^/]+/, "").replace(/\?(t|v)=\w+/g, "").slice(0, 80)).join(" ← ")})`);
    }
    if (state.loadState !== prev.loadState) {
      debugLog(`load state: ${state.loadState}${state.loadError ? ` — ${state.loadError}` : ""}`);
    }
  });
}
