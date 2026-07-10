"use client";
import { useEffect, useRef, useState } from "react";
import { rmsDbfs, autoCorrelatePitch } from "@/lib/audio/pitchDetection";

export interface AudioReadout {
  sampleRate: number;
  rms: number;
  db: number;
  peak: number;
  clipping: boolean;
  pitchHz: number;
  pitchConf: number;
}

const INITIAL_READOUT: AudioReadout = {
  sampleRate: 0, rms: 0, db: -120, peak: 0,
  clipping: false, pitchHz: 0, pitchConf: 0,
};

export function useAudioCapture(deviceId: string, active: boolean) {
  const [readout, setReadout] = useState<AudioReadout>(INITIAL_READOUT);
  const timeBuf = useRef(new Float32Array(2048));
  const freqBuf = useRef(new Uint8Array(1024));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !deviceId) return;
    let cancelled = false;

    async function setup() {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const ctx = new AudioContext({ latencyHint: "interactive" });
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const tick = () => {
        analyser.getFloatTimeDomainData(timeBuf.current);
        analyser.getByteFrequencyData(freqBuf.current);
        const { rms, db, peak } = rmsDbfs(timeBuf.current);
        const pitch = autoCorrelatePitch(timeBuf.current, ctx.sampleRate);
        setReadout({
          sampleRate: ctx.sampleRate, rms, db, peak,
          clipping: peak >= 0.99,
          pitchHz: pitch?.hz ?? 0,
          pitchConf: pitch?.corr ?? 0,
        });
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    setup().catch(console.error);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
    };
  }, [active, deviceId]);

  return { readout, timeBuf: timeBuf.current, freqBuf: freqBuf.current };
}
