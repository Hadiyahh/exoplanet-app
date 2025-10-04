import { useMemo, useState } from "react";

import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
const Plot = createPlotlyComponent(Plotly);

import type { Mission } from "./api";
import { plotPngUrl, fetchLc, predict } from "./api";
import type { PredictResult } from "./api";

function Badge({ label, tone = "neutral" }:{label:string; tone?: "good"|"warn"|"bad"|"neutral"}) {
  return <span className={`badge ${tone}`}>{label}</span>;
}


export default function App() {
  // ---------- Controls ----------
  const [target, setTarget] = useState("Kepler-10");
  const [mission, setMission] = useState<Mission>("Kepler");
  const [author, setAuthor] = useState<string>(""); // use SPOC/QLP for TESS if needed
  const [windowLen, setWindowLen] = useState(401);
  const [tab, setTab] = useState<"plot" | "interactive" | "predict">("plot");
  const [threshold, setThreshold] = useState(0.5);
  const [mock, setMock] = useState(true); // flip OFF when /predict is ready

  const pngUrl = useMemo(() => plotPngUrl(target, mission, windowLen, author || undefined), [target, mission, windowLen, author]);

  // ---------- Interactive LC state ----------
  const [lc, setLc] = useState<{ time:number[]; flux:number[]; flat_time:number[]; flat_flux:number[] } | null>(null);
  const [loadingLc, setLoadingLc] = useState(false);
  const [error, setError] = useState<string>("");

  async function loadLc() {
    setLoadingLc(true); setError("");
    try {
      const data = await fetchLc(target, mission, windowLen, author || undefined);
      setLc(data);
    } catch (e: any) {
      setError(typeof e?.message === "string" ? e.message : String(e));
      setLc(null);
    } finally { setLoadingLc(false); }
  }

  // ---------- Predict state ----------
  const [pred, setPred] = useState<PredictResult | null>(null);
  const [loadingPred, setLoadingPred] = useState(false);

  async function runPredict() {
    setLoadingPred(true); setError("");
    try {
      if (mock) {
        // quick mock: you can move this JSON to /public and fetch it instead
        const fake: PredictResult = {
          target, mission,
          prob_planet: 0.84,
          decision: "planet_like",
          diagnostics: { snr: 18.3, cdpp_ppm: 65, odd_even_diff: 0.01, secondary_snr: 0.2, centroid_sigma: 0.7 },
          top_features: [
            { name: "depth_ppm", value: 520, impact: 0.23 },
            { name: "duration_hr", value: 3.1, impact: 0.17 },
            { name: "secondary_snr", value: 0.2, impact: 0.10 },
            { name: "cdpp_ppm", value: 65, impact: -0.12 },
          ],
          notes: ["No secondary at phase ~0.5", "Odd-even consistent"]
        };
        setPred(fake);
      } else {
        const real = await predict({ target, mission, author: author || undefined, threshold });
        setPred(real);
      }
    } catch (e: any) {
      setError(typeof e?.message === "string" ? e.message : String(e));
      setPred(null);
    } finally { setLoadingPred(false); }
  }

  const decision = (pred?.prob_planet ?? 0) >= threshold ? "planet_like" : "not_planet_like";

  return (
      <div className="container">
        <h1 className="h1">Exoplanet Transit Classifier</h1>
        <p className="sub">Enter a target, pick a mission, view the light curve, then get a probability with reasons.</p>
    
        <div className="controls">
          <label><div className="label">Target</div>
            <input className="inp" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Kepler-10 / K2-18 / TIC 307210830"/>
          </label>
          <label><div className="label">Mission</div>
            <select className="sel" value={mission} onChange={e=>setMission(e.target.value as Mission)}>
              <option>Kepler</option><option>K2</option><option>TESS</option>
            </select>
          </label>
          <label><div className="label">Author (TESS)</div>
            <select className="sel" value={author} onChange={e=>setAuthor(e.target.value)}>
              <option value="">Auto</option><option value="SPOC">SPOC</option><option value="QLP">QLP</option>
            </select>
          </label>
          <label><div className="label">Window length</div>
            <input className="inp" type="number" min={51} max={5001} step={50} value={windowLen}
                  onChange={e=>setWindowLen(parseInt(e.target.value||"401"))}/>
          </label>
          <button onClick={()=>setTab("plot")} className="btn">Plot</button>
          <button onClick={()=>{ setTab("interactive"); loadLc(); }} className="btn">Interactive</button>
        </div>


      {/* Tabs header */}
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <button onClick={()=>setTab("plot")} className={`pill ${tab==="plot"?"active":""}`}>Plot (PNG)</button>
        <button onClick={()=>{ setTab("interactive"); loadLc(); }} className={`pill ${tab==="interactive"?"active":""}`}>Interactive (JSON)</button>
        <button onClick={()=>{ setTab("predict"); runPredict(); }} className={`pill ${tab==="predict"?"active":""}`}>Predict</button>
        <label style={{marginLeft:"auto", fontSize:12}}>
          <input type="checkbox" checked={mock} onChange={e=>setMock(e.target.checked)} /> Mock Predict
        </label>
      </div>



      {/* Error notice */}
      {!!error && <div style={{ background:"#fdeaea", color:"#b42318", padding:12, borderRadius:8, marginBottom:12 }}>{error}</div>}

      {/* Tab content */}
      {tab === "plot" && (
      <div className="card">

        <img
          // Use your computed URL. If this still fails, temporarily hardcode the mock URL in the src line below.
          src={pngUrl}
          // TEMP (if needed during testing): src={`/api/plot-test?window_length=${windowLen}`}
          alt="light curve"
          style={{ width:"100%", display:"block", borderRadius:6 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            const el = document.getElementById("plot-error");
            if (el) el.textContent = `Image failed: ${pngUrl}`;
          }}
          onLoad={() => {
            const el = document.getElementById("plot-error");
            if (el) el.textContent = "";
          }}
        />
        <div id="plot-error" style={{ color:"#b42318", marginTop:8 }}></div>
        <div style={{ fontSize:12, color:"#6b7280", marginTop:8 }}><b>GET</b> <code>{pngUrl}</code></div>
      </div>
    )}


      {tab === "interactive" && (
          <div className="card">
          {loadingLc && <div>Loading light curve…</div>}
          {lc && (
            <>
              <Plot
                data={[
                  { x: lc.time, y: lc.flux, type: "scattergl", mode: "lines", name: "raw" },
                  { x: lc.flat_time, y: lc.flat_flux, type: "scattergl", mode: "lines", name: "flattened" },
                ]}
                layout={{ title: `${target} (${mission})`, xaxis: { title: "Time" }, yaxis: { title: "Flux" }, height: 420, margin:{t:40,r:20,b:40,l:50} }}
                config={{ displaylogo: false }}
                style={{ width:"100%" }}
              />
              <div style={{ fontSize:12, color:"#6b7280", marginTop:8 }}><b>GET</b> <code>{`/api/lc/${encodeURIComponent(target)}?mission=${mission}&window_length=${windowLen}${author?`&author=${author}`:""}`}</code></div>
            </>
          )}
        </div>
      )}

      {tab === "predict" && (
      <div className="card">
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
            <div style={{ fontSize:32, fontWeight:700 }}>
              p(planet) = {pred ? (pred.prob_planet*100).toFixed(1) : "--"}%
            </div>
            <div>
              <Badge label={decision === "planet_like" ? "Planet-like" : "Not planet-like"} tone={decision==="planet_like"?"good":"bad"} />
            </div>
            <div style={{ marginLeft:"auto" }}>
              <label style={{ fontSize:12, color:"#374151" }}>Threshold: {threshold.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.01} value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value))} />
            </div>
            <button onClick={runPredict} className="btn">{loadingPred ? "Scoring…" : "Re-score"}</button>
            </div>

          {/* Diagnostics */}
          <div style={{ marginBottom:12 }}>
            {pred?.diagnostics && (
              <>
                <Badge label={`SNR ${pred.diagnostics.snr ?? "-"}`} tone="good" />
                <Badge label={`CDPP ${pred.diagnostics.cdpp_ppm ?? "-"}`} tone="neutral" />
                <Badge label={`Odd–Even ${pred.diagnostics.odd_even_diff ?? "-"}`} tone="neutral" />
                <Badge label={`Secondary ${pred.diagnostics.secondary_snr ?? "-"}`} tone="neutral" />
                {"centroid_sigma" in (pred.diagnostics) && <Badge label={`Centroid σ ${pred.diagnostics.centroid_sigma}`} tone="neutral" />}
              </>
            )}
          </div>

          {/* Top features */}
          {pred?.top_features && (
            <div>
              <div style={{ fontWeight:600, marginBottom:6 }}>Top contributors</div>
              {pred.top_features.map((f,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"160px 1fr 60px", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ fontSize:13, color:"#374151" }}>{f.name}{typeof f.value==="number" ? `: ${f.value}` : ""}</div>
                  <div style={{ height:8, background:"#f3f4f6", borderRadius:999, overflow:"hidden" }}>
                    <div style={{
                      width: `${Math.min(100, Math.abs(f.impact)*100)}%`,
                      height:"100%",
                      background: f.impact >= 0 ? "#d1fae5" : "#fee2e2"
                    }}/>
                  </div>
                  <div style={{ fontSize:12, color: f.impact>=0 ? "#065f46" : "#991b1b" }}>
                    {f.impact>=0?"+":""}{f.impact.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize:12, color:"#6b7280", marginTop:8 }}><b>{mock?"MOCK ":"POST "}</b>
            <code>{mock ? "/api/predict (mocked in UI)" : "/api/predict"}</code>
          </div>
        </div>
      )}

      {/* Footer status */}
      <div style={{ marginTop:12, fontSize:12, color:"#6b7280" }}>
        Try: Kepler-10 (Kepler), K2-18 (K2), TIC 307210830 (TESS; try author SPOC/QLP)
      </div>
    </div>
  );
}

