// Small inline SVG icons for action buttons. They replace text glyphs (♡ ⬇ ⋮), which render
// at inconsistent sizes per font and — in the case of "⬇" on an add-to-queue button — say
// the wrong thing entirely. All inherit color from the button via currentColor.
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: false,
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function HeartIcon({ filled = false }) {
  return (
    <svg {...base} {...stroke} fill={filled ? "currentColor" : "none"}>
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2 0 3.5 1 5.3 3 1.8-2 3.3-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function QueueAddIcon() {
  return (
    <svg {...base} {...stroke}>
      <path d="M3 6h13M3 12h8M3 18h8" />
      <path d="M17 14v7M13.5 17.5h7" />
    </svg>
  );
}

export function PlaylistPlusIcon() {
  return (
    <svg {...base} {...stroke}>
      <path d="M3 6h13M3 12h8M3 18h8" />
      <path d="M17 13v8M13 17h8" />
    </svg>
  );
}

export function ShuffleIcon({ size = 16 }) {
  return (
    <svg {...base} {...stroke} width={size} height={size}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base} {...stroke}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg {...base} fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

// ── Phone navigation + full-screen player ─────────────────────────────────────

export function HomeIcon({ filled = false }) {
  return (
    <svg {...base} {...stroke} width="24" height="24" fill={filled ? "currentColor" : "none"}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...base} {...stroke} width="24" height="24">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function LibraryIcon({ filled = false }) {
  return (
    <svg {...base} {...stroke} width="24" height="24" fill={filled ? "currentColor" : "none"}>
      <path d="M4 4v16M9 4v16" />
      <path d="m14 5.5 4.5-1.2 3 15.2L17 20.7z" />
    </svg>
  );
}

export function PlusCircleIcon() {
  return (
    <svg {...base} {...stroke} width="24" height="24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...base} {...stroke} width="26" height="26">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function QueueListIcon() {
  return (
    <svg {...base} {...stroke} width="22" height="22">
      <path d="M3 6h14M3 12h14M3 18h8" />
      <path d="m16 15 6 3.5-6 3.5z" fill="currentColor" />
    </svg>
  );
}

export function PlayGlyph({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

export function PauseGlyph({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
    </svg>
  );
}

export function SkipPrevGlyph({ size = 28 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x="4" y="5" width="2.6" height="14" rx="1" />
      <path d="M20 5.8v12.4a1 1 0 0 1-1.55.83L9.6 12.83a1 1 0 0 1 0-1.66l8.85-6.2A1 1 0 0 1 20 5.8z" />
    </svg>
  );
}

export function SkipNextGlyph({ size = 28 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x="17.4" y="5" width="2.6" height="14" rx="1" />
      <path d="M4 5.8v12.4a1 1 0 0 0 1.55.83l8.85-6.2a1 1 0 0 0 0-1.66L5.55 4.97A1 1 0 0 0 4 5.8z" />
    </svg>
  );
}

export function RepeatGlyph({ one = false }) {
  return (
    <svg {...base} {...stroke} width="22" height="22">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      {one && <path d="M12 9.5 13.5 9v5" strokeWidth="1.8" />}
    </svg>
  );
}
