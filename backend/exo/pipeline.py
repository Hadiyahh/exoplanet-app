from typing import Literal, Optional
from pathlib import Path
import shutil
import lightkurve as lk

Mission = Literal["Kepler", "K2", "TESS"]

def _download_all(sr) -> lk.LightCurveCollection:
    """Try download; if it fails due to cache corruption, clear cache and retry once."""
    try:
        return sr.download_all()
    except Exception:
        cache_dir = Path.home() / ".lightkurve" / "cache"
        if cache_dir.exists():
            shutil.rmtree(cache_dir, ignore_errors=True)
        return sr.download_all()

def load_and_flatten(
    target_id: str,
    mission: Mission = "Kepler",
    window_length: int = 401,
    author: Optional[str] = None
):
    """
    Download a mission light curve, clean it, and return (raw_lc, flat_lc).
    Uses search_lightcurve() and stitches multiple sectors/quarters.
    """
    # default author per mission
    if author is None:
        author = "Kepler" if mission in ("Kepler", "K2") else "SPOC"

    sr = lk.search_lightcurve(target_id, mission=mission, author=author)
    if len(sr) == 0:
        # Helpful hint for TESS: try QLP if SPOC missing
        if mission == "TESS" and author == "SPOC":
            raise ValueError(f"No light curves for '{target_id}' ({mission}, author=SPOC). "
                             f"Try author=QLP.")
        raise ValueError(f"No light curves for '{target_id}' (mission={mission}, author={author}).")

    lcs = _download_all(sr)
    if lcs is None or len(lcs) == 0:
        raise ValueError("Download returned no light curves.")

    lc = lcs.stitch().remove_nans().normalize()
    if len(lc.time.value) == 0:
        raise ValueError("Downloaded light curve is empty after cleaning.")

    flat = lc.flatten(window_length=window_length)
    if len(flat.time.value) == 0:
        raise ValueError("Flattened light curve is empty; try a different window_length (e.g., 201 or 801).")

    return lc, flat
