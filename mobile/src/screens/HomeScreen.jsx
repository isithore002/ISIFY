import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { importPlaylist } from '../api/playlist';

const PLAYLISTS_KEY = 'wv_playlists';

export default function HomeScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(PLAYLISTS_KEY)
      .then((raw) => { if (raw) setPlaylists(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const mutation = useMutation({
    mutationFn: importPlaylist,
    onSuccess: async (data) => {
      const updated = [data, ...playlists.filter((p) => p.id !== data.id)];
      setPlaylists(updated);
      await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updated));
      setUrl('');
    },
  });

  return (
    <View style={s.container}>
      <View style={s.importRow}>
        <TextInput
          style={s.input}
          placeholder="Spotify playlist, album or track link…"
          placeholderTextColor="#B3B3B3"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[s.btn, mutation.isPending && s.btnDisabled]}
          onPress={() => { if (url.trim()) mutation.mutate(url.trim()); }}
          disabled={mutation.isPending}
        >
          <Text style={s.btnTxt}>{mutation.isPending ? '…' : 'Import'}</Text>
        </TouchableOpacity>
      </View>

      {mutation.isError && (
        <Text style={s.error}>
          {mutation.error?.response?.data?.detail || 'Import failed'}
        </Text>
      )}

      <Text style={s.sectionLabel}>YOUR LIBRARY</Text>

      {playlists.length === 0 ? (
        <Text style={s.empty}>No playlists yet. Paste a Spotify link above.</Text>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.playlistRow}
              onPress={() => navigation.navigate('Playlist', { playlist: item })}
            >
              {item.cover_url
                ? <Image source={{ uri: item.cover_url }} style={s.thumb} />
                : <View style={[s.thumb, s.thumbFallback]} />}
              <View style={s.playlistInfo}>
                <Text style={s.playlistName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.playlistMeta} numberOfLines={1}>
                  {item.owner} · {item.tracks.length} songs
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  importRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  input: {
    flex: 1,
    backgroundColor: '#282828',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  btn: {
    backgroundColor: '#1DB954',
    borderRadius: 6,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: '#000', fontWeight: '700', fontSize: 14 },
  error: { color: '#f55', fontSize: 12, marginBottom: 8 },
  sectionLabel: {
    color: '#B3B3B3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  empty: { color: '#B3B3B3', textAlign: 'center', marginTop: 32, fontSize: 14 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  thumb: { width: 54, height: 54, borderRadius: 4 },
  thumbFallback: { backgroundColor: '#282828' },
  playlistInfo: { flex: 1 },
  playlistName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  playlistMeta: { color: '#B3B3B3', fontSize: 12, marginTop: 2 },
});
