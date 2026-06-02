import { useEffect, useRef, useState } from "react";
import { multiplierAt, generateCrashMultiplier } from "@/lib/jetx";
import jetPlane from "@/assets/jet-plane-full.png";

export type GamePhase = "waiting" | "flying" | "crashed";

interface Props {
  onPhaseChange: (phase: GamePhase, currentMult: number, crashMult: number) => void;
  onTick: (mult: number) => void;
  onRoundEnd?: (crash: number) => void;
}

const WAIT_SECONDS = 5;

export const JetXCanvas = ({ onPhaseChange, onTick, onRoundEnd }: Props) => {
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [mult, setMult] = useState(1.0);
  const [crashMult, setCrashMult] = useState(0);
  const [waitMs, setWaitMs] = useState(WAIT_SECONDS * 1000); // for smooth bar
  const phaseRef = useRef<GamePhase>("waiting");
  const crashRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const waitStartRef = useRef(0);
  const waitRafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const runWait = (afterMs: number, onDone: () => void) => {
      waitStartRef.current = performance.now();
      const tick = () => {
        const elapsed = performance.now() - waitStartRef.current;
        const remaining = Math.max(0, afterMs - elapsed);
        setWaitMs(remaining);
        if (remaining <= 0) { onDone(); return; }
        waitRafRef.current = requestAnimationFrame(tick);
      };
      waitRafRef.current = requestAnimationFrame(tick);
    };

    const begin = () => {
      const cm = generateCrashMultiplier();
      crashRef.current = cm;
      setCrashMult(cm);
      setMult(1.0);
      startRef.current = performance.now();
      phaseRef.current = "flying";
      setPhase("flying");
      onPhaseChange("flying", 1.0, cm);

      const loop = () => {
        const m = multiplierAt(performance.now() - startRef.current);
        if (m >= crashRef.current) {
          setMult(crashRef.current);
          phaseRef.current = "crashed";
          setPhase("crashed");
          onPhaseChange("crashed", crashRef.current, crashRef.current);
          onRoundEnd?.(crashRef.current);
          // Brief crash flash, then go straight to waiting + progress bar
          setTimeout(() => {
            phaseRef.current = "waiting";
            setPhase("waiting");
            onPhaseChange("waiting", 1.0, 0);
            setWaitMs(WAIT_SECONDS * 1000);
            runWait(WAIT_SECONDS * 1000, () => setTimeout(begin, 50));
          }, 900);
          return;
        }
        setMult(m);
        onTick(m);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };

    setPhase("waiting");
    onPhaseChange("waiting", 1.0, 0);
    setWaitMs(WAIT_SECONDS * 1000);
    runWait(WAIT_SECONDS * 1000, begin);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (waitRafRef.current) cancelAnimationFrame(waitRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plane progress along arc — viewBox is 1000 x 600
  // Crashed: snap back to start instantly (plane exits fast & waits for next round)
  const effectiveMult = phase === "crashed" ? 1 : mult;
  const VW = 1000, VH = 600;
  const multProgress = Math.min(1, Math.log(effectiveMult) / Math.log(8));

  // Slower, gentler launch — ease into motion instead of sprinting
  const LAUNCH_MS = 1600;
  const elapsed = phase === "flying" ? performance.now() - startRef.current : 0;
  const launchT = Math.min(1, elapsed / LAUNCH_MS);
  // ease-out quad (softer than cubic)
  const launchEase = 1 - Math.pow(1 - launchT, 2);
  // Cap launch contribution lower so plane keeps drifting forward instead of parking mid-canvas
  const launchProgress = phase === "flying" ? launchEase * 0.28 : 0;

  let progress = Math.max(launchProgress, multProgress);
  // Continuous slow drift forward so plane never freezes in the middle
  if (phase === "flying") {
    const drift = Math.min(0.25, elapsed / 22000); // up to +25% over ~22s
    progress = Math.min(1, progress + drift);
  }

  const x0 = 30, y0 = VH - 30;
  // Larger play area — envelope reaches almost the full width, but plane is clamped below
  const rawXEnd = 50 + progress * (VW - 60);

  // Climb height grows with multiplier → taller red envelope
  const climbBase = VH * 0.28;
  const climbBoost = progress * VH * 0.72;

  // Match the clamping used for the plane so envelope tip and plane stay glued
  const TIP_MARGIN_X = 150;
  const TIP_MARGIN_Y_TOP = 110;
  const TIP_MARGIN_Y_BOTTOM = 90;
  const xEndLimit = VW - TIP_MARGIN_X;
  const atRightEdge = phase === "flying" && rawXEnd >= xEndLimit;

  // Stronger up/down sway throughout the whole flight (more dramatic at the right edge)
  const bobAmp = atRightEdge ? 95 : 38;
  const bobSpeed = atRightEdge ? 360 : 480;
  const bob = phase === "flying" ? Math.sin(elapsed / bobSpeed) * bobAmp : 0;
  const rawYEnd = (VH - 35) - (climbBase + climbBoost) + bob;

  const xEnd = Math.min(xEndLimit, Math.max(0, rawXEnd));
  const yEnd = Math.max(TIP_MARGIN_Y_TOP, Math.min(VH - TIP_MARGIN_Y_BOTTOM, rawYEnd));

  // Lock plane to a fixed shallow ~3° nose-up tilt
  const planeRot = phase === "flying" ? -3 : 0;
  // Trail (red envelope) ends exactly where the plane body sits.
  // Plane is positioned at (px, py) with translate(-33%, -50%) and width ~16vw.
  // Its visual body center sits roughly at (px - planeW*0.17, py). We tuck the
  // trail tip slightly *into* the plane belly so there's never a visible gap,
  // even at the very start when the multiplier is low.
  // Approx plane width in viewBox units (clamp(140px, 16vw, 230px) → ~14% of VW)
  const planeVW = VW * 0.14;
  const tipX = xEnd - planeVW * 0.18; // tuck into the body
  const tipY = yEnd + 8;              // sit just under the fuselage
  const cx = x0 + (tipX - x0) * 0.55;
  const cy = y0 - (y0 - tipY) * 0.15;
  const trailPath = `M ${x0} ${y0} Q ${cx} ${cy}, ${tipX} ${tipY}`;
  const fillPath = `${trailPath} L ${tipX} ${VH} L ${x0} ${VH} Z`;

  const waitProgress = 1 - waitMs / (WAIT_SECONDS * 1000);
  const waitSecs = Math.ceil(waitMs / 1000);

  return (
    <div
      className="relative w-full aspect-[16/10] sm:aspect-[16/9] md:aspect-[16/8.5] overflow-hidden shadow-card"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, oklch(0.22 0.04 200) 0%, oklch(0.12 0.02 200) 70%, oklch(0.08 0.01 200) 100%)",
      }}
    >
      {/* Concentric rings backdrop (matches bingo page) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="rings" />
      </div>

      {/* Drifting particles (wind motion) */}
      <div className="absolute inset-0 bg-particles pointer-events-none opacity-40" />


      {/* Trail SVG (only while flying) */}
      {phase === "flying" && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trailFill" x1="0" y1="100%" x2="0" y2="0%">
              <stop offset="0%" stopColor="hsl(0 90% 55%)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="hsl(0 90% 55%)" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#trailFill)" />
          <path
            d={trailPath}
            stroke="hsl(0 95% 60%)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px hsl(0 95% 55%))" }}
          />
        </svg>
      )}

      {/* Center content: multiplier / crashed flash / waiting progress bar */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
        <div className="text-center w-full max-w-md">
          {phase === "waiting" && (
            <div className="space-y-3">
              <div className="text-white/90 text-sm sm:text-base font-semibold uppercase tracking-widest">
                Waiting for next round
              </div>
              <div className="text-3xl sm:text-5xl font-bold text-white tabular-nums" style={{ textShadow: "0 0 20px hsl(0 90% 55% / 0.6)" }}>
                {waitSecs}s
              </div>
              <div className="h-3 sm:h-4 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${waitProgress * 100}%`,
                    background: "linear-gradient(90deg, hsl(0 90% 55%), hsl(15 95% 60%))",
                    boxShadow: "0 0 20px hsl(0 90% 55% / 0.7)",
                    transition: "width 80ms linear",
                  }}
                />
              </div>
            </div>
          )}
          {phase === "flying" && (
            <div
              className="text-5xl sm:text-7xl font-black tabular-nums text-white"
              style={{
                filter: "drop-shadow(0 0 18px rgba(255,255,255,0.55)) drop-shadow(0 2px 0 rgba(0,0,0,0.5))",
              }}
            >
              {mult.toFixed(2)}<span className="text-4xl sm:text-6xl">x</span>
            </div>
          )}
          {phase === "crashed" && (
            <>
              <div className="text-destructive text-base sm:text-lg font-semibold mb-2 uppercase tracking-widest">Flew Away!</div>
              <div className="text-4xl sm:text-6xl font-bold text-destructive tabular-nums" style={{ textShadow: "0 0 25px hsl(0 90% 55% / 0.7)" }}>
                {crashMult.toFixed(2)}x
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plane: visible while flying, exits fast on crash, parked during waiting */}
      {(() => {
        const isFlying = phase === "flying";
        const isCrashed = phase === "crashed";
        const PLANE_MARGIN_X = 150;
        const PLANE_MARGIN_Y_TOP = 110;
        const PLANE_MARGIN_Y_BOTTOM = 90;
        const clampedX = Math.min(VW - PLANE_MARGIN_X, Math.max(0, xEnd));
        const clampedY = Math.max(PLANE_MARGIN_Y_TOP, Math.min(VH - PLANE_MARGIN_Y_BOTTOM, yEnd));
        // On crash: shoot off the right edge fast and fade out
        const px = isCrashed ? VW + 350 : isFlying ? clampedX : x0;
        const py = isCrashed ? Math.max(PLANE_MARGIN_Y_TOP, clampedY - 80) : isFlying ? clampedY : y0;
        return (
          <div
            className="absolute pointer-events-none select-none"
            style={{
              left: `${(px / VW) * 100}%`,
              top: `${(py / VH) * 100}%`,
              width: "clamp(140px, 16vw, 230px)",
              transform: `translate(-33%, -50%) rotate(${isCrashed ? -8 : isFlying ? planeRot : 0}deg)`,
              transformOrigin: "left bottom",
              filter: "drop-shadow(0 8px 20px rgba(255,20,120,0.5))",
              opacity: isCrashed ? 0 : 1,
              transition: isCrashed
                ? "left 0.45s cubic-bezier(0.5,0,0.9,0.4), top 0.45s ease-out, opacity 0.5s ease-out 0.2s"
                : "top 0.08s linear, left 0.08s linear",
            }}
          >
            <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
              <img
                src={jetPlane}
                alt="JetX plane"
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};
