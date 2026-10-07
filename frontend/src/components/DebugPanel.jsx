import { useState, useSyncExternalStore } from "react";
import { clearDebug, getDebugLines, subscribeDebug } from "../lib/debugLog";

// Only rendered when the app was opened with ?debug (see lib/debugLog.js)
export default function DebugPanel() {
  const lines = useSyncExternalStore(subscribeDebug, getDebugLines);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5000,
        background: "rgba(0,0,0,0.88)",
        color: "#9cf29c",
        font: "10px/1.35 ui-monospace, Menlo, Consolas, monospace",
        borderBottom: "1px solid #1ed760",
      }}
    >
      <div style={{ display: "flex", gap: 10, padding: "4px 8px", color: "#fff", fontWeight: 700 }}>
        <span style={{ flex: 1 }}>DEBUG — {lines.length} events</span>
        <button onClick={clearDebug} style={{ color: "#ffd479" }}>clear</button>
        <button onClick={() => setCollapsed((c) => !c)} style={{ color: "#ffd479" }}>
          {collapsed ? "show" : "hide"}
        </button>
      </div>
      {!collapsed && (
        <div
          style={{ maxHeight: "42vh", overflowY: "auto", padding: "0 8px 6px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
          ref={(el) => el && (el.scrollTop = el.scrollHeight)}
        >
          {lines.join("\n")}
        </div>
      )}
    </div>
  );
}
