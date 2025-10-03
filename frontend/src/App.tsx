import { useMemo, useState } from "react";

type Mission = "Kepler" | "K2" | "TESS";

export default function App() {
  // UI state
  const [target, setTarget] = useState("Kepler-10"); // try: "Kepler-10", "K2-18", "TIC 307210830"
  const [mission, setMission] = useState<Mission>("Kepler");
  const [windowLen, setWindowLen] = useState(401);

  // Build the image URL the <img> will use
  const imgUrl = useMemo(() => {
    const t = encodeURIComponent(target.trim());
    return `/api/plot/${t}?mission=${mission}&window_length=${windowLen}`;
  }, [target, mission, windowLen]);

  // Optional: small flag to force reload on button click (prevents every keystroke reload)
  const [showSrc, setShowSrc] = useState<string>(imgUrl);

  // Keep <img> src in sync when deps change, but only update when user clicks "Show Plot"
  // If you prefer live-update on each change, skip the button and just set <img src={imgUrl}>
  const onShowPlot = () => setShowSrc(imgUrl);

  return (
    <div style={{ maxWidth: 960, margin: "32px auto", fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Exoplanet Light Curve Viewer</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Enter a target (e.g., <code>Kepler-10</code>, <code>K2-18</code>, <code>TIC 307210830</code>) and pick a mission.
      </p>

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, color: "#555" }}>Target ID</div>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Kepler-10"
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, color: "#555" }}>Mission</div>
          <select
            value={mission}
            onChange={(e) => setMission(e.target.value as Mission)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="Kepler">Kepler</option>
            <option value="K2">K2</option>
            <option value="TESS">TESS</option>
          </select>
        </label>

        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, color: "#555" }}>Window length (flatten)</div>
          <input
            type="number"
            min={51} max={5001} step={50}
            value={windowLen}
            onChange={(e) => setWindowLen(parseInt(e.target.value || "401", 10))}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <button
          onClick={onShowPlot}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #0a7", background: "#0a7", color: "#fff", cursor: "pointer" }}
        >
          Show Plot
        </button>
      </div>

      {/* Plot container */}
      <div style={{ marginTop: 20, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        {/* If you want live update without clicking, change src={showSrc} → src={imgUrl} */}
        <img
          key={showSrc}  // forces reload when URL changes
          src={showSrc}
          alt="light curve"
          style={{ width: "100%", height: "auto", display: "block" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            console.error("Failed to load plot image:", showSrc);
          }}
          onLoad={(e) => (e.target as HTMLImageElement).style.display = "block"}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
          <div><b>Backend URL</b>: <code>{showSrc}</code></div>
          <div>Tip: if the image doesn’t load, paste that URL into your browser to see the backend error message.</div>
        </div>
      </div>

      {/* Optional: quick link to JSON for debugging */}
      <details style={{ marginTop: 12 }}>
        <summary>Debug JSON (for JS plotting later)</summary>
        <div style={{ marginTop: 10, fontSize: 13 }}>
          Fetch this in dev tools or a small component:
          <div><code>{`/api/lc/${encodeURIComponent(target)}?mission=${mission}&window_length=${windowLen}`}</code></div>
        </div>
      </details>
    </div>
  );
}
