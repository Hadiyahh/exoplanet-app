export type Mission = "Kepler" | "K2" | "TESS";
export type PredictResult = {
  target: string;
  mission: Mission;
  prob_planet: number;
  threshold?: number;
  decision?: "planet_like" | "not_planet_like";
  diagnostics?: Record<string, number | string>;
  top_features?: { name: string; value?: number; impact: number }[];
  notes?: string[];
};

export function plotPngUrl(_target: string, _mission: Mission, windowLen: number, author?: string) {
    const a = author ? `&author=${encodeURIComponent(author)}` : "";
    return `/api/plot-test?window_length=${windowLen}${a}`;
  }
  

// export async function fetchLc(target: string, mission: Mission, windowLen: number, author?: string) {
//   const t = encodeURIComponent(target.trim());
//   const a = author ? `&author=${encodeURIComponent(author)}` : "";
//   const url = `/api/lc/${t}?mission=${mission}&window_length=${windowLen}${a}`;
//   const res = await fetch(url);
//   if (!res.ok) throw new Error(await res.text());
//   return res.json() as Promise<{ time:number[]; flux:number[]; flat_time:number[]; flat_flux:number[] }>;
// }
export async function fetchLc(_t: string, _m: Mission, windowLen: number, author?: string) {
    const a = author ? `&author=${encodeURIComponent(author)}` : "";
    const url = `/api/lc-test?window_length=${windowLen}${a}`;  // <-- MOCK endpoint
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ time:number[]; flux:number[]; flat_time:number[]; flat_flux:number[] }>;
  }
  
export async function predict(body: { target: string; mission: Mission; author?: string; threshold?: number }) {
  const res = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PredictResult>;
}
