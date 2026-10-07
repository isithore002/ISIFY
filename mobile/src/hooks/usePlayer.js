import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { usePlayerStore } from '../store/playerStore';
import { getCachedTrackUri } from './useOfflineCache';
import { prepareTrack } from '../api/track';
import { API_URL } from '../config';

export function usePlayer() {
  const store = usePlayerStore();
  const soundRef = useRef(null);

  const track = store.queue[store.currentIndex] ?? null;

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    const { setPlaying, setDuration, setProgress, setSound, next, volume } = usePlayerStore.getState();

    const load = async () => {
      // Unload previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      // Allow background audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      });

      // Prefer offline cache, fall back to server stream
      let uri = await getCachedTrackUri(track.id);
      if (!uri) {
        const status = await prepareTrack(track);
        if (status.status !== 'ready') throw new Error(status.error || 'Prepare failed');
        uri = `${API_URL}/api/track/${track.id}/file`;
      }

      if (cancelled) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume },
        (status) => {
          if (!status.isLoaded) return;
          // While buffering isPlaying is false even though playback is intended;
          // mirroring that into the store would trigger the pause effect below.
          if (!status.isBuffering || status.isPlaying) setPlaying(status.isPlaying);
          if (status.durationMillis) {
            setDuration(status.durationMillis / 1000);
            setProgress((status.positionMillis ?? 0) / status.durationMillis);
          }
          if (status.didJustFinish) next();
        },
      );

      if (cancelled) {
        await sound.unloadAsync().catch(() => {});
        return;
      }

      soundRef.current = sound;
      setSound(sound);
    };

    load().catch((err) => console.error('Playback error:', err));

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [track?.id]);

  // Volume sync
  useEffect(() => {
    soundRef.current?.setVolumeAsync(store.volume).catch(() => {});
  }, [store.volume]);

  // Play / pause sync (triggered by external store changes only — the status callback handles internal ones)
  useEffect(() => {
    if (!soundRef.current) return;
    if (store.playing) {
      soundRef.current.playAsync().catch(() => {});
    } else {
      soundRef.current.pauseAsync().catch(() => {});
    }
  }, [store.playing]);

  const seek = async (ratio) => {
    if (!soundRef.current || !store.duration) return;
    const ms = ratio * store.duration * 1000;
    await soundRef.current.setPositionAsync(ms).catch(() => {});
    store.setProgress(ratio);
  };

  return { seek };
}
