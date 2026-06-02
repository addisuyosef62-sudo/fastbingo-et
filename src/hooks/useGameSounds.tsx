import { useCallback, useEffect, useRef } from "react";

// Aviator-style WebAudio SFX — rising engine drone + impactful crash boom.
// No external assets or API keys required.
export const useGameSounds = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const flightRef = useRef<{
    stopAll: () => void;
    rampInterval: number;
    startTime: number;
  } | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  // Unlock audio on first user gesture
  useEffect(() => {
    const unlock = () => { getCtx(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [getCtx]);

  const startFlight = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || flightRef.current) return;

    const now = ctx.currentTime;

    // === Master chain ===
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.35, now + 0.25);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = "lowpass";
    masterFilter.frequency.setValueAtTime(900, now);
    masterFilter.Q.value = 0.9;
    masterFilter.connect(master).connect(ctx.destination);

    // === Engine drone: 3 detuned sawtooths for thick propeller/jet body ===
    const baseFreq = 70; // low engine rumble base
    const oscs: OscillatorNode[] = [];
    const oscGains: GainNode[] = [];
    [0, 0.4, -0.4].forEach((detune, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.detune.setValueAtTime(detune * 12, now);
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.22 : 0.14;
      osc.connect(g).connect(masterFilter);
      osc.start(now);
      oscs.push(osc);
      oscGains.push(g);
    });

    // High harmonic whine (turbine shimmer)
    const whine = ctx.createOscillator();
    whine.type = "square";
    whine.frequency.setValueAtTime(baseFreq * 6, now);
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.025;
    const whineHP = ctx.createBiquadFilter();
    whineHP.type = "highpass";
    whineHP.frequency.value = 600;
    whine.connect(whineHP).connect(whineGain).connect(master);
    whine.start(now);

    // Continuous wind/air noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.6;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseBP = ctx.createBiquadFilter();
    noiseBP.type = "bandpass";
    noiseBP.frequency.setValueAtTime(800, now);
    noiseBP.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.08;
    noise.connect(noiseBP).connect(noiseGain).connect(master);
    noise.start(now);

    // === Tension ramp: pitch + filter open + intensity grow over time ===
    const startTime = performance.now();
    const rampInterval = window.setInterval(() => {
      if (!ctxRef.current) return;
      const t = ctxRef.current.currentTime;
      const elapsed = (performance.now() - startTime) / 1000;
      // Logarithmic-ish rise that keeps climbing
      const climb = Math.min(elapsed / 12, 1); // 0..1 over ~12s, then sustains
      const extra = Math.log2(1 + elapsed / 4) * 0.5; // keeps rising slowly after
      const pitchMul = 1 + climb * 2.2 + extra; // up to ~3.5x+
      const targetFreq = baseFreq * pitchMul;
      oscs.forEach(o => o.frequency.linearRampToValueAtTime(targetFreq, t + 0.15));
      whine.frequency.linearRampToValueAtTime(targetFreq * 6 + elapsed * 40, t + 0.15);
      masterFilter.frequency.linearRampToValueAtTime(900 + climb * 4500 + extra * 800, t + 0.15);
      noiseBP.frequency.linearRampToValueAtTime(800 + climb * 2200, t + 0.15);
      noiseGain.gain.linearRampToValueAtTime(0.08 + climb * 0.12, t + 0.15);
      whineGain.gain.linearRampToValueAtTime(0.025 + climb * 0.05, t + 0.15);
    }, 120);

    const stopAll = () => {
      const ctxNow = ctxRef.current?.currentTime ?? 0;
      master.gain.cancelScheduledValues(ctxNow);
      master.gain.linearRampToValueAtTime(0, ctxNow + 0.18);
      try { oscs.forEach(o => o.stop(ctxNow + 0.22)); } catch {}
      try { whine.stop(ctxNow + 0.22); } catch {}
      try { noise.stop(ctxNow + 0.22); } catch {}
    };

    flightRef.current = { stopAll, rampInterval, startTime };
  }, [getCtx]);

  const stopFlight = useCallback(() => {
    if (!flightRef.current) return;
    window.clearInterval(flightRef.current.rampInterval);
    flightRef.current.stopAll();
    flightRef.current = null;
  }, []);

  const playCrash = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    // Stop engine instantly if still running
    if (flightRef.current) {
      window.clearInterval(flightRef.current.rampInterval);
      flightRef.current.stopAll();
      flightRef.current = null;
    }

    const now = ctx.currentTime;

    // === Sub boom (impact thump) ===
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.5);
    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.75);

    // === Explosion noise burst ===
    const burstLen = 1.2;
    const buf = ctx.createBuffer(1, ctx.sampleRate * burstLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // Sharp attack, exponential decay
      const env = Math.pow(1 - t, 2.2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3500, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.9);
    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.7, now);
    burstGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    src.connect(lp).connect(burstGain).connect(ctx.destination);
    src.start(now);

    // === Metallic crunch (bandpassed noise click) ===
    const crunchBuf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const cd = crunchBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 1.5);
    const csrc = ctx.createBufferSource();
    csrc.buffer = crunchBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 1.2;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.5, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    csrc.connect(bp).connect(cg).connect(ctx.destination);
    csrc.start(now);
  }, [getCtx]);

  const playCashout = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const notes = [880, 1175, 1568, 2093];
    notes.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
    // Coin shimmer
    const shimBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const sd = shimBuf.getChannelData(0);
    for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sd.length, 2);
    const ssrc = ctx.createBufferSource();
    ssrc.buffer = shimBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;
    const sg = ctx.createGain();
    sg.gain.value = 0.08;
    ssrc.connect(hp).connect(sg).connect(ctx.destination);
    ssrc.start(ctx.currentTime);
  }, [getCtx]);

  return { startFlight, stopFlight, playCrash, playCashout };
};
