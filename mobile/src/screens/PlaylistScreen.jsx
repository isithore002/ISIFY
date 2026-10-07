import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { cacheTrack, isTrackCached } from '../hooks/useOfflineCache';

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TrackRow({ track, index, isCurrent, isPlaying, onPlay }) {
  const [caching, setCaching] = useState(false);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    isTrackCached(track.id).then(setCached);
  }, [track.id]);

  const handleCache = async () => {
    setCaching(true);
    try {
      await cacheTrack(track);
      setCached(true);
    } catch (e) {
      console.error('Cache error:', e);
    }
    setCaching(false);
  };

  return (
    <TouchableOpacity
      style={[s.row, isCurrent && s.rowActive]}
      onPress={onPlay}
      activeOpacity={0.7}
    >
      <View style={s.numWrap}>
        {isCurrent && isPlaying
          ? <Text style={s.playIcon}>▶</Text>
          : <Text style={s.num}>{index + 1}</Text>}
      </View>

      {track.cover_url
        ? <Image source={{ uri: track.cover_url }} style={s.cover} />
        : <View style={[s.cover, s.coverFallback]} />}

      <View style={s.meta}>
        <Text style={[s.title, isCurrent && s.titleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
      </View>

      <TouchableOpacity onPress={handleCache} disabled={caching || cached} style={s.iconBtn}>
        <Text style={s.iconTxt}>{caching ? '⏳' : cached ? '✓' : '⬇'}</Text>
      </TouchableOpacity>

      <Text style={s.dur}>{fmt(track.duration_ms)}</Text>
    </TouchableOpacity>
  );
}

export default function PlaylistScreen({ route, navigation }) {
  const { playlist } = route.params;
  const store = usePlayerStore();

  useEffect(() => {
    navigation.setOptions({ title: playlist.name });
  }, [playlist.name]);

  const handlePlay = (index) => {
    if (store.currentIndex === index && store.playlistId === playlist.id) {
      store.setPlaying(!store.playing);
    } else {
      store.setQueue(playlist.tracks, index, playlist.id);
      store.setPlaying(true);
    }
  };

  return (
    <View style={s.container}>
      <FlatList
        data={playlist.tracks}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 8 }}
        ListHeaderComponent={
          <View style={s.header}>
            {playlist.cover_url && (
              <Image source={{ uri: playlist.cover_url }} style={s.hero} />
            )}
            <Text style={s.typeLabel}>PLAYLIST</Text>
            <Text style={s.playlistTitle}>{playlist.name}</Text>
            {!!playlist.description && (
              <Text style={s.desc} numberOfLines={2}>{playlist.description}</Text>
            )}
            <Text style={s.ownerLine}>
              {playlist.owner} · {playlist.tracks.length} songs
            </Text>
            <TouchableOpacity style={s.playAllBtn} onPress={() => handlePlay(0)}>
              <Text style={s.playAllTxt}>▶  Play All</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            index={index}
            isCurrent={store.currentIndex === index && store.playlistId === playlist.id}
            isPlaying={store.playing}
            onPlay={() => handlePlay(index)}
          />
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { alignItems: 'center', padding: 20, paddingBottom: 12 },
  hero: { width: 180, height: 180, borderRadius: 8, marginBottom: 16 },
  typeLabel: { color: '#B3B3B3', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  playlistTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  desc: { color: '#B3B3B3', fontSize: 13, textAlign: 'center', marginTop: 6 },
  ownerLine: { color: '#B3B3B3', fontSize: 13, marginTop: 8 },
  playAllBtn: {
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 36,
    marginTop: 16,
  },
  playAllTxt: { color: '#000', fontWeight: '700', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  rowActive: { backgroundColor: '#1a1a1a' },
  numWrap: { width: 24, alignItems: 'center' },
  num: { color: '#B3B3B3', fontSize: 13 },
  playIcon: { color: '#1DB954', fontSize: 13 },
  cover: { width: 44, height: 44, borderRadius: 4 },
  coverFallback: { backgroundColor: '#282828' },
  meta: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  titleActive: { color: '#1DB954' },
  artist: { color: '#B3B3B3', fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 8 },
  iconTxt: { color: '#B3B3B3', fontSize: 16 },
  dur: { color: '#B3B3B3', fontSize: 12, width: 38, textAlign: 'right' },
});
