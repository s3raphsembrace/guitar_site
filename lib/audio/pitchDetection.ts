// Pure audio utility functions – extracted from InputTest.tsx

export function rmsDbfs(x: Float32Array) {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sum / x.length);
  const db = 20 * Math.log10(rms + 1e-9);
  return { rms, db, peak };
}

export function autoCorrelatePitch(x: Float32Array, sampleRate: number) {
  const { rms } = rmsDbfs(x);
  if (rms < 0.01) return null;

  let mean = 0;
  for (let i = 0; i < x.length; i++) mean += x[i];
  mean /= x.length;

  const SIZE = x.length;
  const MIN_HZ = 80;
  const MAX_HZ = 1200;
  const maxLag = Math.floor(sampleRate / MIN_HZ);
  const minLag = Math.floor(sampleRate / MAX_HZ);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let n1 = 0;
    let n2 = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      const a = x[i] - mean;
      const b = x[i + lag] - mean;
      corr += a * b;
      n1 += a * a;
      n2 += b * b;
    }
    corr /= Math.sqrt(n1 * n2) + 1e-12;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag === -1 || bestCorr < 0.55) return null;
  return { hz: sampleRate / bestLag, corr: bestCorr };
}
