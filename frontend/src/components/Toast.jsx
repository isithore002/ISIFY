import { usePlayerStore } from "../store/playerStore";

export default function Toast() {
  const toast = usePlayerStore((s) => s.toast);

  if (!toast) return null;

  // role="status" makes screen readers announce each message as it appears; keying on the
  // toast id restarts the slide-in animation when one message replaces another.
  return (
    <div className="wv-toast-container" role="status" aria-live="polite">
      <div className="wv-toast" key={toast.id}>
        <span className="wv-toast-dot" aria-hidden="true" />
        <span className="wv-toast-msg">{toast.message}</span>
      </div>
    </div>
  );
}
