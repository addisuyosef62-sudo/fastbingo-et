// JetX game engine helpers
const JETX_QUEUE_KEY = "fk_jetx_crashes";

export function getJetXCrashQueue(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(JETX_QUEUE_KEY);
    const arr = v ? JSON.parse(v) : [];
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number" && n >= 1) : [];
  } catch { return []; }
}
export function setJetXCrashQueue(arr: number[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(JETX_QUEUE_KEY, JSON.stringify(arr));
}
export function clearJetXCrashQueue() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JETX_QUEUE_KEY);
}

export function generateCrashMultiplier(): number {
  // Admin-controlled queue takes priority
  const q = getJetXCrashQueue();
  if (q.length > 0) {
    const next = q.shift()!;
    setJetXCrashQueue(q);
    return Math.max(1.0, Math.min(1000, Math.round(next * 100) / 100));
  }
  if (Math.random() < 0.03) return 1.0;
  const r = Math.random();
  const m = 0.97 / (1 - r);
  return Math.max(1.0, Math.min(1000, Math.round(m * 100) / 100));
}
export function multiplierAt(elapsedMs: number): number {
  const t = elapsedMs / 1000;
  return Math.round(Math.pow(1.07, t) * 100) / 100;
}
export const MIN_BET = 5;
export const MAX_WIN = 50000;
export const MAX_MULTIPLIER = 1000;
export function betExceedsCap(bet: number): boolean {
  return bet * MAX_MULTIPLIER > MAX_WIN;
}
export function fmtBirr(n: number): string {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}
