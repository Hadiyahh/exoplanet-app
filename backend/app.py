# backend/app.py
import io
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

import matplotlib
matplotlib.use("Agg")  # headless rendering BEFORE importing pyplot
import matplotlib.pyplot as plt

from exo.pipeline import load_and_flatten

Mission = Literal["Kepler", "K2", "TESS"]

app = FastAPI(title="Exoplanet Backend", version="0.1.0")

# Allow React dev server to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"ok": True, "msg": "Backend up. See /docs"}

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/plot-test")
def plot_test():
    """Sanity check route: proves matplotlib+FastAPI can return a PNG."""
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.plot([0, 1, 0, 1, 0])
    ax.set_title("plot-test")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return Response(buf.read(), media_type="image/png")

@app.get("/lc/{target_id}")
def lc_json(
    target_id: str,
    mission: Mission = Query("Kepler", pattern="^(Kepler|K2|TESS)$"),
    window_length: int = Query(401, ge=51, le=5001),
):
    """Return raw & flattened arrays as JSON (useful for JS plotting later)."""
    try:
        lc, flat = load_and_flatten(target_id, mission=mission, window_length=window_length)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    return JSONResponse({
        "mission": mission,
        "target": target_id,
        "time": lc.time.value.tolist(),
        "flux": lc.flux.value.tolist(),
        "flat_time": flat.time.value.tolist(),
        "flat_flux": flat.flux.value.tolist(),
    })

@app.get("/plot/{target_id}")
def plot_png(
    target_id: str,
    mission: Mission = Query("Kepler", pattern="^(Kepler|K2|TESS)$"),
    window_length: int = Query(401, ge=51, le=5001),
):
    """Render flattened light curve as a PNG."""
    try:
        _, flat = load_and_flatten(target_id, mission=mission, window_length=window_length)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    fig, ax = plt.subplots(figsize=(8, 3))
    flat.plot(ax=ax, normalize=False)
    ax.set_title(f"{target_id} ({mission}) — flattened")
    ax.set_xlabel("Time")
    ax.set_ylabel("Flux (norm)")

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return Response(buf.read(), media_type="image/png")
