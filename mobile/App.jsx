import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import PlaylistScreen from './src/screens/PlaylistScreen';
import Player from './src/components/Player';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

const NAV_THEME = {
  dark: true,
  colors: {
    background: '#121212',
    card: '#181818',
    text: '#ffffff',
    border: '#282828',
    primary: '#1DB954',
    notification: '#1DB954',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <View style={s.shell}>
          <NavigationContainer theme={NAV_THEME}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: '#181818' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '700' },
              }}
            >
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'WaveVault' }}
              />
              <Stack.Screen
                name="Playlist"
                component={PlaylistScreen}
                options={{ title: '' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          <Player />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#121212' },
});
