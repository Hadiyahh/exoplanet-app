# backend/app.py
import io
from typing import List, Optional, Literal, Dict, Any
from math import exp

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

import matplotlib
matplotlib.use("Agg")  # headless backend
import matplotlib.pyplot as plt

Mission = Literal["Kepler", "K2", "TESS"]

app = FastAPI(title="Exoplanet Backend (Mock)")

# --- CORS so your React dev server can call us ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Synthetic data generator ----------
def synthetic_transit(
    period: float = 3.0,
    depth: float = 0.003,       # 0.3% = 3000 ppm
    duration: float = 0.15,     # in days
    tspan: float = 27.0,        # total time span (days)
    cadence: float = 0.02,      # ~30 min
    jitter: float = 0.0008,     # white noise amplitude
    trend_amp: float = 0.0015,  # slow trend amplitude
    seed: int = 42,
):
    """
    Make a toy light curve with periodic transits + noise + slow trend.
    """
    rng = np.random.default_rng(seed)
    n = int(tspan / cadence)
    time = np.arange(n) * cadence
    # baseline ~1 with slow sinusoidal trend
    trend = trend_amp * np.sin(2*np.pi*time / (tspan/2))
    flux = 1.0 + trend + rng.normal(0, jitter, size=n)

    # inject transits every 'period' days (simple V/U-ish dip using a gaussian kernel)
    for k in range(int(tspan // period) + 2):
        tc = k * period + period*0.3  # phase offset
        # gaussian-like “dip”
        width = duration / 5.0
        dip = depth * np.exp(-0.5 * ((time - tc) / width) ** 2)
        flux -= dip

    return time, flux

def flatten(flux: np.ndarray, window_length: int = 401) -> np.ndarray:
    """
    Simple moving-median flatten (toy; good enough for mock).
    window_length must be odd and <= len(flux).
    """
    wl = int(window_length)
    if wl % 2 == 0: wl += 1
    wl = max(3, min(wl, len(flux) - (len(flux)+1)%2))
    pad = wl // 2
    med = np.convolve(np.pad(flux, (pad, pad), mode="edge"),
                      np.ones(wl)/wl, mode="valid")
    # Normalize around 1.0
    flat = flux / med
    return flat

# ---------- Health & root ----------
@app.get("/")
def root():
    return {"ok": True, "msg": "Mock backend up. See /docs."}

@app.get("/health")
def health():
    return {"ok": True}

# ---------- PLOT: PNG (mock) ----------
@app.get("/plot-test")
def plot_test(
    window_length: int = Query(401, ge=51, le=5001),
    period: float = Query(3.0, gt=0),
    depth_ppm: float = Query(1500, ge=10, le=20000),  # 1500 ppm default
):
    depth = depth_ppm / 1e6
    t, f = synthetic_transit(period=period, depth=depth)
    f_flat = flatten(f, window_length=window_length)

    fig, ax = plt.subplots(2, 1, figsize=(9, 4.2), sharex=True)
    ax[0].plot(t, f, lw=0.8)
    ax[0].set_ylabel("Flux")
    ax[0].set_title("Synthetic Light Curve (raw)")

    ax[1].plot(t, f_flat, lw=0.8)
    ax[1].set_ylabel("Flux (flat)")
    ax[1].set_xlabel("Time [days]")
    ax[1].axhline(1.0, color="gray", lw=0.7, ls="--")

    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return Response(buf.read(), media_type="image/png")

# ---------- LC JSON (mock) ----------
@app.get("/lc-test")
def lc_test(
    window_length: int = Query(401, ge=51, le=5001),
    period: float = Query(3.0, gt=0),
    depth_ppm: float = Query(1500, ge=10, le=20000),
):
    depth = depth_ppm / 1e6
    t, f = synthetic_transit(period=period, depth=depth)
    f_flat = flatten(f, window_length=window_length)
    return JSONResponse({
        "time": t.tolist(),
        "flux": f.tolist(),
        "flat_time": t.tolist(),
        "flat_flux": f_flat.tolist(),
    })

# ---------- PREDICT (mock) ----------
@app.post("/predict")
def predict(
    body: Dict[str, Any]
):
    """
    Mock scoring endpoint.
    Uses a toy rule: deeper dips + decent SNR -> higher probability.
    """
    target = str(body.get("target", "Mock-1"))
    mission = str(body.get("mission", "Kepler"))
    threshold = float(body.get("threshold", 0.5))

    # pretend we computed diagnostics
    diagnostics = {
        "snr": 18.3,
        "cdpp_ppm": 65,
        "odd_even_diff": 0.01,
        "secondary_snr": 0.2,
        "centroid_sigma": 0.7,
    }

    # toy probability from diagnostics (bounded 0..1)
    score = 0.6
    score += 0.15 * (diagnostics["snr"] / 20.0)           # higher snr helps
    score -= 0.10 * (diagnostics["cdpp_ppm"] / 100.0)     # noisier hurts
    score -= 0.40 * min(1.0, diagnostics["secondary_snr"])# secondary hurts a lot
    score -= 0.30 * min(1.0, diagnostics["odd_even_diff"]*10) # odd-even mismatch hurts
    score = max(0.0, min(1.0, score))

    decision = "planet_like" if score >= threshold else "not_planet_like"

    top_features = [
        {"name": "depth_ppm", "value": 520, "impact": +0.23},
        {"name": "duration_hr", "value": 3.1, "impact": +0.17},
        {"name": "secondary_snr", "value": 0.2, "impact": -0.10},
        {"name": "cdpp_ppm", "value": 65, "impact": -0.12},
    ]

    return JSONResponse({
        "target": target,
        "mission": mission,
        "prob_planet": round(float(score), 3),
        "threshold": threshold,
        "decision": decision,
        "diagnostics": diagnostics,
        "top_features": top_features,
        "notes": ["Mock scoring; replace with real model later"]
    })


# # backend/app.py
# import io
# from typing import Literal

# from fastapi import FastAPI, HTTPException, Query
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import Response, JSONResponse

# import matplotlib
# matplotlib.use("Agg")  # headless rendering BEFORE importing pyplot
# import matplotlib.pyplot as plt

# from exo.pipeline import load_and_flatten

# Mission = Literal["Kepler", "K2", "TESS"]

# app = FastAPI(title="Exoplanet Backend", version="0.1.0")

# # Allow React dev server to call us
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173", "http://localhost:3000"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.get("/")
# def root():
#     return {"ok": True, "msg": "Backend up. See /docs"}

# @app.get("/health")
# def health():
#     return {"ok": True}

# @app.get("/plot-test")
# def plot_test():
#     """Sanity check route: proves matplotlib+FastAPI can return a PNG."""
#     fig, ax = plt.subplots(figsize=(6, 3))
#     ax.plot([0, 1, 0, 1, 0])
#     ax.set_title("plot-test")
#     buf = io.BytesIO()
#     fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
#     plt.close(fig)
#     buf.seek(0)
#     return Response(buf.read(), media_type="image/png")

# @app.get("/lc/{target_id}")
# def lc_json(
#     target_id: str,
#     mission: Mission = Query("Kepler", pattern="^(Kepler|K2|TESS)$"),
#     window_length: int = Query(401, ge=51, le=5001),
# ):
#     """Return raw & flattened arrays as JSON (useful for JS plotting later)."""
#     try:
#         lc, flat = load_and_flatten(target_id, mission=mission, window_length=window_length)
#     except Exception as e:
#         raise HTTPException(status_code=404, detail=str(e))

#     return JSONResponse({
#         "mission": mission,
#         "target": target_id,
#         "time": lc.time.value.tolist(),
#         "flux": lc.flux.value.tolist(),
#         "flat_time": flat.time.value.tolist(),
#         "flat_flux": flat.flux.value.tolist(),
#     })

# @app.get("/plot/{target_id}")
# def plot_png(
#     target_id: str,
#     mission: Mission = Query("Kepler", pattern="^(Kepler|K2|TESS)$"),
#     window_length: int = Query(401, ge=51, le=5001),
# ):
#     """Render flattened light curve as a PNG."""
#     try:
#         _, flat = load_and_flatten(target_id, mission=mission, window_length=window_length)
#     except Exception as e:
#         raise HTTPException(status_code=404, detail=str(e))

#     fig, ax = plt.subplots(figsize=(8, 3))
#     flat.plot(ax=ax, normalize=False)
#     ax.set_title(f"{target_id} ({mission}) — flattened")
#     ax.set_xlabel("Time")
#     ax.set_ylabel("Flux (norm)")

#     buf = io.BytesIO()
#     fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
#     plt.close(fig)
#     buf.seek(0)
#     return Response(buf.read(), media_type="image/png")
