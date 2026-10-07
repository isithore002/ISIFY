// Authentic mock data mirroring the exact musfluent UI screenshot
export const HERO_ARTIST = {
  id: "artist-billie-eilish",
  name: "Billie Eilish",
  verified: true,
  monthlyListeners: "82,736,050 monthly listeners",
  bannerImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&h=500&fit=crop",
  featuredSong: {
    id: "billie-birds",
    title: "Birds of a Feather",
    artist: "Billie Eilish",
    album: "HIT ME HARD AND SOFT",
    duration_ms: 196000,
    cover_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
  },
};

export const TRENDY_SONGS = [
  {
    id: "trendy-1",
    title: "Brainwash",
    artist: "Darwish",
    album: "Brainwash EP",
    duration_ms: 214000,
    cover_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
    plays: "128,490,120",
  },
  {
    id: "trendy-2",
    title: "Heatin' up",
    artist: "Ninesoul",
    album: "Inferno",
    duration_ms: 185000,
    cover_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=400&fit=crop",
    plays: "94,320,800",
  },
  {
    id: "trendy-3",
    title: "Rounds",
    artist: "The Freak",
    album: "Vinyl Memories",
    duration_ms: 228000,
    cover_url: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=400&h=400&fit=crop",
    plays: "76,145,900",
  },
  {
    id: "trendy-4",
    title: "Born to die",
    artist: "White man's / Lana",
    album: "Born to Die",
    duration_ms: 286000,
    cover_url: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=400&h=400&fit=crop",
    plays: "512,883,040",
  },
];

export const POPULAR_SONGS = [
  {
    id: "pop-01",
    rank: 1,
    title: "Shiver",
    artist: "Ed Sheeran",
    album: "=",
    duration_ms: 207000,
    durationText: "3:27",
    plays: "460,228,511",
    cover_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
  },
  {
    id: "pop-02",
    rank: 2,
    title: "Birds of a Feather",
    artist: "Billie Eilish",
    album: "HIT ME HARD AND SOFT",
    duration_ms: 196000,
    durationText: "3:16",
    plays: "420,119,430",
    cover_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
  },
  {
    id: "pop-03",
    rank: 3,
    title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    album: "Starboy",
    duration_ms: 230000,
    durationText: "3:50",
    plays: "398,550,110",
    cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
  },
  {
    id: "pop-04",
    rank: 4,
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    duration_ms: 243000,
    durationText: "4:03",
    plays: "312,890,700",
    cover_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop",
  },
];

export const FRIENDS_LIST = [
  {
    id: "f1",
    name: "James Foster",
    status: "Listening to Starboy",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&h=120&fit=crop",
    isFollowing: true,
  },
  {
    id: "f2",
    name: "Wilson Roy",
    status: "Listening to Heatin' up",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    isFollowing: false,
  },
  {
    id: "f3",
    name: "Jason Mraz",
    status: "Offline 2h ago",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    isFollowing: false,
  },
  {
    id: "f4",
    name: "Tom Allen",
    status: "Listening to Shiver",
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&h=120&fit=crop",
    isFollowing: true,
  },
];

export const DEFAULT_LIBRARY_PLAYLISTS = [
  {
    id: "lib-best-year",
    name: "Best of year",
    owner: "ISIFY",
    tracksCount: 50,
    icon: "globe",
  },
  {
    id: "lib-best-month",
    name: "Best of month",
    owner: "ISIFY",
    tracksCount: 28,
    icon: "disc",
  },
  {
    id: "lib-folk-diary",
    name: "Folk diary",
    owner: "ISIFY",
    tracksCount: 19,
    icon: "compass",
  },
];

export const INITIAL_PLAYER_TRACK = {
  id: "track-summer-of-love",
  title: "Summer of Love",
  artist: "Caturday",
  album: "Neon Dreams",
  duration_ms: 286000,
  cover_url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop",
};
