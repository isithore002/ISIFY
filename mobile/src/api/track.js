import api from './client';

export const prepareTrack = (track) =>
  api.post('/api/track/prepare', {
    track_id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    track_number: track.track_number ?? 0,
    duration_ms: track.duration_ms ?? 0,
    cover_url: track.cover_url ?? null,
  }).then((r) => r.data);
