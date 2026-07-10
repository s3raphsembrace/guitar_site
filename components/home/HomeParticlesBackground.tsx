"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

interface HomeParticlesBackgroundProps {
  className?: string;
}

interface ParticleFieldProps {
  count: number;
  mobile: boolean;
  reducedMotion: boolean;
}

function seededUnitFloat(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

const vertexShader = `
attribute float aScale;
attribute float aPhase;

uniform float uTime;
uniform float uRadius;
uniform float uPointScale;
uniform float uReducedMotion;

varying float vAlpha;
varying float vMix;
varying float vSeed;

void main() {
  vec3 transformed = position;

  float dist = length(transformed);
  float radial = length(transformed.xz);
  float swirlMask = 1.0 - smoothstep(0.0, uRadius, dist);

  float motionMix = 1.0 - uReducedMotion;
  float swirlSpeed = mix(0.02, 0.14, motionMix);
  float angle = uTime * (swirlSpeed + swirlMask * 0.28) + aPhase + radial * 0.45;

  float c = cos(angle);
  float s = sin(angle);
  transformed.xz = mat2(c, -s, s, c) * transformed.xz;

  transformed.y += sin(angle * 0.62 + aPhase) * 0.18 * swirlMask * motionMix;

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  float depthScale = clamp(18.0 / -mvPosition.z, 1.0, 5.8);

  gl_PointSize = aScale * uPointScale * depthScale;
  vAlpha = smoothstep(uRadius, 0.0, dist);
  vMix = clamp(dist / uRadius, 0.0, 1.0);
  vSeed = fract(sin(aPhase * 91.135) * 43758.5453);

  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying float vAlpha;
varying float vMix;
varying float vSeed;

void main() {
  vec2 centered = gl_PointCoord - 0.5;
  float dist = length(centered);
  float halo = smoothstep(0.52, 0.0, dist);
  float core = smoothstep(0.18, 0.0, dist);
  float centerBias = pow(1.0 - vMix, 1.45);

  vec3 coolOuter = vec3(0.19, 0.34, 0.95);
  vec3 coolInner = vec3(0.78, 0.86, 1.0);
  vec3 warmOuter = vec3(1.0, 0.57, 0.24);
  vec3 warmInner = vec3(1.0, 0.83, 0.55);
  vec3 starlight = vec3(1.0, 0.97, 0.92);

  vec3 coolColor = mix(coolOuter, coolInner, core);
  vec3 warmColor = mix(warmOuter, warmInner, core);

  float warmMix = clamp(centerBias * (0.35 + vSeed * 0.65), 0.0, 1.0);
  vec3 baseColor = mix(coolColor, warmColor, warmMix);
  vec3 color = mix(baseColor, starlight, core * (0.45 + warmMix * 0.35));

  float alpha = halo * (0.16 + vAlpha * 0.62) + core * (0.28 + vAlpha * 0.44);

  if (alpha <= 0.001) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
`;

function ParticleField({ count, mobile, reducedMotion }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null>(null);

  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const seed = (index + 1) * 1.61803398875 + count * 0.13;
      const radius = Math.pow(seededUnitFloat(seed), 0.6) * 4.4;
      const theta = seededUnitFloat(seed * 1.31) * Math.PI * 2;
      const phi = Math.acos(2 * seededUnitFloat(seed * 1.73) - 1);

      positions[stride] = radius * Math.sin(phi) * Math.cos(theta);
      positions[stride + 1] = radius * Math.cos(phi) * 0.7;
      positions[stride + 2] = radius * Math.sin(phi) * Math.sin(theta);

      scales[index] = 0.45 + seededUnitFloat(seed * 2.11) * 1.4;
      phases[index] = seededUnitFloat(seed * 2.71) * Math.PI * 2;
    }

    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    buffer.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    return buffer;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: 4.6 },
          uPointScale: { value: 12.6 },
          uReducedMotion: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    const cloud = pointsRef.current;
    if (!cloud) return;

    const shader = cloud.material;
    const elapsed = state.clock.getElapsedTime();
    shader.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
    shader.uniforms.uPointScale.value = mobile ? 9.2 : 12.6;
    shader.uniforms.uTime.value = reducedMotion ? 0 : elapsed;

    if (reducedMotion) {
      cloud.rotation.x = -0.06;
      cloud.rotation.y = 0.16;
      return;
    }

    cloud.rotation.y = elapsed * 0.035 + Math.sin(elapsed * 0.21) * 0.08;
    cloud.rotation.x = Math.cos(elapsed * 0.17) * 0.04;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export function HomeParticlesBackground({ className }: HomeParticlesBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 768px)");

    const sync = () => {
      setReducedMotion(motionQuery.matches);
      setMobile(mobileQuery.matches);
    };

    sync();

    motionQuery.addEventListener("change", sync);
    mobileQuery.addEventListener("change", sync);

    return () => {
      motionQuery.removeEventListener("change", sync);
      mobileQuery.removeEventListener("change", sync);
    };
  }, []);

  const particleCount = reducedMotion ? (mobile ? 120 : 240) : mobile ? 680 : 1300;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        frameloop={reducedMotion ? "demand" : "always"}
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, mobile ? 8.2 : 6.8], fov: mobile ? 64 : 56 }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
      >
        <ParticleField count={particleCount} mobile={mobile} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
