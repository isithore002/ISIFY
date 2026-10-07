import { useEffect, useRef } from "react";
import { Howl, Howler } from "howler";
import { usePlayerStore } from "../store/playerStore";
import { getPlaySource, prepareTrack, trackFileUrl, trackErrorMessage, warmTracks } from "../api/track";
import { getCachedTrack } from "./useOfflineCache";

const IS_PHONE = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// By default Howler holds an HTML5 sound back until the browser fires "canplaythrough" — "I
// could play the whole file without stalling". For a streamed song the browser needs a while
// to be that sure: measured on desktop Chrome, the audio was ready ("canplay") ~90 ms after the
// click but sound didn't start until 0.7–1.1 s. "canplay" fires as soon as playback can begin;
// anything still downloading simply fills in behind it.
//
// Phones keep the conservative default. Their audio engines report a song's length later than
// desktop Chrome, and Howler reads that length at this moment — an early read of 0 makes it
// declare the song already over, so every song "ended" instantly and the queue raced ahead.
Howler._canPlayEvent = IS_PHONE ? "canplaythrough" : "canplay";

// Howler normally builds a "whole song" range from the length it reads at load time and treats
// a start position at or beyond that range's end as "already finished". Giving it a fixed,
// generous range removes that path: a song now ends only when the audio element itself says so.
const WHOLE_SONG = { __default: [0, 24 * 60 * 60 * 1000] };

// Some players report "ended" when nothing has really played. Real songs don't finish after a
// few seconds of playing, so an "end" that early is a failed load, not the end of the song.
const PREMATURE_END_MS = 4000;

// Take a Howl out of service without letting its events reach the store. unload() on a
// playing sound fires "stop" synchronously, and the old onstop handler set playing=false —
// which cancelled the autoplay that clicking the NEW song had just asked for. That's why a
// song only started on its own when nothing else was playing.
function retire(howl) {
  if (!howl) return;
  howl.off();
  howl.unload();
}

export function usePlayer() {
  const store = usePlayerStore();
  const howlRef = useRef(null);
  const userSeekedRef = useRef(false); // seeking near the end makes a legitimately short listen
  const commitListenTimeRef = useRef(() => {});

  const track = store.queue[store.currentIndex] ?? null;
  const trackKey = track ? track.queueKey || `${track.id}-${store.currentIndex}` : null;

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    let objectUrl = null;
    let howl = null;
    let triedFallback = false;
    const { setPlaying, setProgress, setDuration, setLoadState } = usePlayerStore.getState();

    // A failed prepare/load must never leave the UI showing "playing" with no audio.
    const fail = (message) => {
      if (cancelled) return;
      setLoadState("error", message);
      setPlaying(false);
      usePlayerStore.getState().showToast(`Couldn't play "${track.title}": ${message}`);
    };

    retire(howlRef.current);
    howlRef.current = null;
    userSeekedRef.current = false;
    commitListenTimeRef.current = () => {};
    setProgress(0);
    setDuration(0);
    usePlayerStore.getState().ensureUpNext(); // autoplay: line up songs like this one right away

    const restart = () => {
      if (!howl) return;
      howl.seek(0);
      howl.play();
      usePlayerStore.getState().setProgress(0);
      usePlayerStore.getState().setPlaying(true);
    };

    // The slow-but-certain route: run the whole download → convert → tag pipeline, then play
    // the finished MP3. Used when a live stream can't be loaded.
    const fallbackToFile = async () => {
      try {
        setLoadState("finding");
        const status = await prepareTrack(track);
        if (cancelled) return;
        if (status.status !== "ready") throw new Error(status.error || "Prepare failed");
        startHowl(trackFileUrl(track.id), "mp3");
      } catch (err) {
        fail(await trackErrorMessage(err));
      }
    };

    const startHowl = (src, format, { live = false } = {}) => {
      if (cancelled) return;
      retire(howl);
      setLoadState("loading");

      // How long this sound has genuinely been playing (excluding pauses)
      let playedMs = 0;
      let uncommittedMs = 0;
      let resumedAt = null;
      const commitPlayedMs = () => {
        if (resumedAt !== null) {
          const delta = performance.now() - resumedAt;
          playedMs += delta;
          uncommittedMs += delta;
          resumedAt = null;
        }
        if (uncommittedMs > 0) {
          usePlayerStore.getState().addListenTimeMs(uncommittedMs);
          uncommittedMs = 0;
        }
      };
      commitListenTimeRef.current = commitPlayedMs;
      const startClock = () => { if (resumedAt === null) resumedAt = performance.now(); };
      const stopClock = commitPlayedMs;

      howl = new Howl({
        src: [src],
        // Blob and stream URLs have no file extension, so Howler needs the format spelled out
        format: [format],
        html5: true,
        sprite: WHOLE_SONG,
        volume: usePlayerStore.getState().volume,
        onplay: () => {
          startClock();
          setPlaying(true);
          setLoadState("idle");
        },
        onpause: () => {
          stopClock();
          setPlaying(false);
        },
        onstop: () => {
          stopClock();
          setPlaying(false);
        },
        onend: () => {
          stopClock();

          // An "end" a moment after starting isn't the end of a song. Advancing on it would
          // rush through the whole queue (each song "ending" instantly), so treat it as a failed
          // load — try the cached MP3 once if this was a live stream — instead of skipping.
          // (Judged by the song's own metadata, not the player's reading — that's what's suspect.)
          const genuinelyShort = track.duration_ms > 0 && track.duration_ms < 2 * PREMATURE_END_MS;
          if (playedMs < PREMATURE_END_MS && !userSeekedRef.current && !genuinelyShort) {
            if (live && !triedFallback) {
              triedFallback = true;
              return fallbackToFile();
            }
            return fail(`playback stopped after ${(playedMs / 1000).toFixed(1)}s — this device's player reported the song as finished`);
          }

          const s = usePlayerStore.getState();
          if (s.repeat === "one") return restart();

          if (s.currentIndex < s.queue.length - 1) return s.next();

          // End of the queue. With autoplay the answer is normally already in (asked when this
          // song started); if not, this waits for it rather than falling silent.
          s.ensureUpNext().then((added) => {
            if (cancelled) return; // the listener moved on to something else meanwhile
            const now = usePlayerStore.getState();
            if (added && now.currentIndex < now.queue.length - 1) return now.next();
            if (now.autoplayOn && now.autoplayQueue) now.showToast("Couldn't find similar songs to keep playing");
            now.setPlaying(false);
          });
        },
        onload: () => {
          setDuration(howl.duration());
          setLoadState("idle");
        },
        onloaderror: (_, err) => {
          if (live && !triedFallback) {
            triedFallback = true;
            fallbackToFile();
          } else {
            fail(`audio wouldn't load (${err})`);
          }
        },
        onplayerror: (_, err) => fail(`audio wouldn't play (${err})`),
      });

      howlRef.current = howl;
      if (usePlayerStore.getState().playing) howl.play();
    };

    const loadAndPlay = async () => {
      // 1. A local file plays straight from disk.
      if (track.file) {
        objectUrl = URL.createObjectURL(track.file);
        return startHowl(objectUrl, track.format || "mp3");
      }

      // 2. A copy saved for offline use in this browser.
      const saved = await getCachedTrack(track.id);
      if (cancelled) return;
      if (saved) {
        objectUrl = URL.createObjectURL(saved.blob);
        return startHowl(objectUrl, "mp3");
      }

      // 3. The backend: a cached MP3, or a live stream that starts within about a second.
      setLoadState("finding");
      const source = await getPlaySource(track);
      if (cancelled) return;
      startHowl(source.url, source.format, { live: source.source === "live" });
    };

    loadAndPlay().catch(async (err) => fail(await trackErrorMessage(err)));

    return () => {
      cancelled = true;
      commitListenTimeRef.current();
      retire(howl);
      if (howlRef.current === howl) howlRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  // Get the next song ready while this one plays, so skipping ahead (or letting it run on)
  // starts instantly instead of paying the lookup cost then.
  const nextTrack = store.queue[store.currentIndex + 1] ?? null;
  const nextKey = nextTrack?.queueKey ?? null;
  useEffect(() => {
    if (!nextTrack || nextTrack.file || nextTrack.local) return;
    // Look the next song up shortly after this one starts, so skipping ahead (or letting it
    // run on) begins in about a second instead of paying the full lookup then. This is
    // deliberately only a lookup: downloading it too would compete with the song that is
    // playing for the very same bandwidth.
    const lookUp = setTimeout(() => warmTracks([nextTrack]).catch(() => {}), 3000);
    return () => clearTimeout(lookUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey]);

  // volume sync
  useEffect(() => {
    howlRef.current?.volume(store.volume);
  }, [store.volume]);

  // playing sync — guarded, since Howl.play() on a playing sound starts a second instance
  useEffect(() => {
    const howl = howlRef.current;
    if (!howl) return;
    if (store.playing && !howl.playing()) howl.play();
    else if (!store.playing && howl.playing()) howl.pause();
  }, [store.playing]);

  // progress ticker
  useEffect(() => {
    if (!store.playing) return;
    const id = setInterval(() => {
      const howl = howlRef.current;
      const dur = howl?.duration();
      if (dur) usePlayerStore.getState().setProgress((howl.seek() || 0) / dur);
    }, 500);
    return () => clearInterval(id);
  }, [store.playing]);

  const seek = (ratio) => {
    userSeekedRef.current = true; // jumping near the end legitimately leaves only seconds to play
    const dur = howlRef.current?.duration() || 0;
    howlRef.current?.seek(ratio * dur);
    store.setProgress(ratio);
  };

  const handlePrev = () => {
    const howl = howlRef.current;
    const currentSeconds = howl?.seek() || 0;
    if (currentSeconds > 3) {
      howl?.seek(0);
      usePlayerStore.getState().setProgress(0);
    } else {
      const res = store.prev();
      if (res?.restart && howl) {
        howl.seek(0);
        usePlayerStore.getState().setProgress(0);
      }
    }
  };

  const handleNext = () => {
    store.next();
  };

  return { seek, handlePrev, handleNext };
}
