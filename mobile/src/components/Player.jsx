import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { usePlayerStore } from '../store/playerStore';
import { usePlayer } from '../hooks/usePlayer';

function fmt(ratio, duration) {
  const s = Math.floor(ratio * duration);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Player() {
  const store = usePlayerStore();
  const { seek } = usePlayer();
  const track = store.currentTrack();

  if (!track) return null;

  return (
    <View style={s.player}>
      <Slider
        style={s.seekBar}
        minimumValue={0}
        maximumValue={1}
        value={store.progress}
        onSlidingComplete={seek}
        minimumTrackTintColor="#1DB954"
        maximumTrackTintColor="#535353"
        thumbTintColor="#fff"
      />
      <View style={s.row}>
        {track.cover_url
          ? <Image source={{ uri: track.cover_url }} style={s.art} />
          : <View style={[s.art, s.artFallback]} />}

        <View style={s.info}>
          <Text style={s.title} numberOfLines={1}>{track.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
        </View>

        <View style={s.times}>
          <Text style={s.time}>{fmt(store.progress, store.duration)}</Text>
          <Text style={s.time}>-{fmt(1 - store.progress, store.duration)}</Text>
        </View>

        <View style={s.controls}>
          <TouchableOpacity onPress={store.prev} style={s.ctrlBtn}>
            <Text style={s.ctrlTxt}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => store.setPlaying(!store.playing)}
            style={s.playBtn}
          >
            <Text style={s.playTxt}>{store.playing ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={store.next} style={s.ctrlBtn}>
            <Text style={s.ctrlTxt}>⏭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  player: {
    backgroundColor: '#181818',
    borderTopWidth: 1,
    borderTopColor: '#282828',
    paddingBottom: 4,
  },
  seekBar: { width: '100%', height: 24, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },
  art: { width: 44, height: 44, borderRadius: 4 },
  artFallback: { backgroundColor: '#282828' },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 13, fontWeight: '600' },
  artist: { color: '#B3B3B3', fontSize: 11, marginTop: 1 },
  times: { alignItems: 'flex-end', gap: 2 },
  time: { color: '#B3B3B3', fontSize: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctrlBtn: { padding: 8 },
  ctrlTxt: { color: '#fff', fontSize: 18 },
  playBtn: {
    backgroundColor: '#1DB954',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTxt: { color: '#000', fontSize: 18, fontWeight: '700' },
});
