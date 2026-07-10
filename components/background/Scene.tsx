"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

const MODEL_URL = "/models/telecaster/telecaster_40th_draco.glb";
const DRACO_DECODER_PATH = "/draco/gltf/";
const PARTICLE_COUNT = 98000;
const BODY_PARTICLE_SHARE = 0.84;
const NORMALIZED_MODEL_SIZE = 2.2;
const TARGET_OFFSET_Y = 0.34;
const TARGET_DEPTH_SCALE = 0.48;
const TARGET_ROTATION_Y = Math.PI * 0.5;
const DEFAULT_YAW = -Math.PI * 0.25;
const DEFAULT_ROLL = -Math.PI * 0.17;
const MORPH_IN_DURATION = 5.8;
const HOLD_DURATION = 2.8;
const MORPH_OUT_DURATION = 4.1;
const CYCLE_DURATION = MORPH_IN_DURATION + HOLD_DURATION + MORPH_OUT_DURATION;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_DECODER_PATH);

interface SceneProps {
  mode?: 0 | 1;
  intensity?: number;
}

interface ParticleFieldProps {
  modelUrl: string;
  mode: 0 | 1;
  intensity: number;
  mouse: MutableRefObject<THREE.Vector2>;
  dragRotation: MutableRefObject<THREE.Vector2>;
}

interface ParticleRigProps {
  mode: 0 | 1;
  intensity: number;
}

type ParticleUniforms = {
  uTime: THREE.IUniform<number>;
  uMouse: THREE.IUniform<THREE.Vector2>;
  uIntensity: THREE.IUniform<number>;
  uMorph: THREE.IUniform<number>;
  uMode: THREE.IUniform<number>;
};

type SampledMesh = {
  sampler: MeshSurfaceSampler;
  matrixWorld: THREE.Matrix4;
  key: string;
  area: number;
};

const particleVert = /* glsl */ `
  precision highp float;

  attribute vec3 aTarget;
  attribute float aScale;
  attribute float aSeed;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uIntensity;
  uniform float uMorph;

  varying float vAlpha;
  varying float vSeed;
  varying float vPulse;
  varying float vMorph;
  varying float vViewZ;

  mat2 rotate2D(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec3 vortex = position;
    float swirl = uTime * (1.05 + 0.45 * aSeed) + length(vortex.xz) * 3.25;
    vortex.xz = rotate2D(swirl) * vortex.xz;
    vortex.y += sin(uTime * 1.8 + aSeed * 41.0) * 0.2;
    float funnel = smoothstep(3.3, 0.3, length(vortex.xz));
    vortex.y *= mix(1.0, 0.56, funnel);

    vec3 target = aTarget;
    float morph = smoothstep(0.0, 1.0, clamp(uMorph, 0.0, 1.0));
    vec3 p = mix(vortex, target, morph);

    float residual = 1.0 - morph;
    p += vec3(
      sin(uTime * (1.95 + aSeed) + aSeed * 91.0),
      cos(uTime * (2.15 + 0.7 * aSeed) + aSeed * 71.0),
      sin(uTime * (1.75 + 0.5 * aSeed) + aSeed * 53.0)
    ) * 0.05 * residual;

    vec3 dir = normalize(target + vec3(0.0001));
    float pulse = 0.5 + 0.5 * sin(uTime * 2.1 + aSeed * 57.0 + length(target) * 4.6);
    p += dir * pulse * 0.038 * morph;

    vec2 m = (uMouse - 0.5) * vec2(0.02, 0.014) * (1.0 - morph);
    p.yz = rotate2D(m.y) * p.yz;
    p.xz = rotate2D(m.x) * p.xz;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float depth = max(0.25, -mvPosition.z);
    float depthScale = clamp(0.95 / depth, 0.3, 1.45);

    float baseSize = mix(1.95 + 5.9 * aScale, 0.78 + 2.9 * aScale, morph);
    gl_PointSize = baseSize * depthScale * max(0.55, uIntensity);
    vAlpha = 0.28 + 0.72 * morph;
    vSeed = aSeed;
    vPulse = pulse;
    vMorph = morph;
    vViewZ = mvPosition.z;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFrag = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uMode;

  varying float vAlpha;
  varying float vSeed;
  varying float vPulse;
  varying float vMorph;
  varying float vViewZ;

  void main() {
    if (vViewZ > -0.02) discard;

    vec2 centered = gl_PointCoord * 2.0 - 1.0;
    float dist = length(centered);

    float core = smoothstep(0.56, 0.0, dist);
    float halo = smoothstep(1.0, 0.25, dist);
    float rim = smoothstep(0.86, 0.66, dist) - smoothstep(0.66, 0.52, dist);

    float twinkleLow = 0.74 + 0.28 * sin(uTime * (2.1 + vSeed * 0.8) + vSeed * 89.0);
    float twinkleHigh = 0.94 + 0.08 * sin(uTime * (1.3 + vSeed * 0.28) + vSeed * 47.0);
    float twinkle = mix(twinkleLow, twinkleHigh, vMorph);
    float radiate = 0.68 + vPulse * 0.72;

    vec3 deepBlue = vec3(0.02, 0.09, 0.28);
    vec3 coolBlue = vec3(0.18, 0.58, 1.0);
    vec3 iceBlue = vec3(0.74, 0.92, 1.0);

    vec3 color = mix(deepBlue, coolBlue, halo);
    color = mix(color, iceBlue, core * core);
    color *= 0.64 + rim * 0.5 + radiate * 0.28 + vMorph * 0.16;

    if (uMode > 0.5) {
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(color, vec3(luma), 0.26);
    }

    float haloGain = mix(1.0, 0.56, vMorph);
    float rimGain = mix(1.0, 0.6, vMorph);
    float alpha = (core * 1.28 + halo * 0.6 * haloGain + rim * 0.75 * rimGain) * vAlpha * twinkle * radiate;
    if (alpha < 0.006) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

function seededUnitFloat(index: number, multiplier: number): number {
  const value = Math.sin((index + 1) * multiplier) * 43758.5453123;
  return value - Math.floor(value);
}

function signedSeed(index: number, multiplier: number): number {
  return seededUnitFloat(index, multiplier) * 2 - 1;
}

function materialKey(material: THREE.Material | THREE.Material[] | undefined): string {
  if (!material) return "";
  if (Array.isArray(material)) {
    return material
      .map((entry) => entry?.name ?? "")
      .filter(Boolean)
      .join(" ");
  }

  return material.name ?? "";
}

function buildCumulativeWeights(entries: SampledMesh[], mode: "body" | "other") {
  const cumulative: number[] = [];
  let total = 0;

  for (const entry of entries) {
    let weight = entry.area;
    const key = entry.key;

    if (mode === "body") {
      if (key.includes("body")) weight *= 2.5;
      if (key.includes("pickguard")) weight *= 1.5;
    } else {
      if (
        key.includes("string") ||
        key.includes("screw") ||
        key.includes("tuner") ||
        key.includes("knob")
      ) {
        weight *= 0.18;
      }
      if (key.includes("neck")) weight *= 0.78;
      if (key.includes("head")) weight *= 0.72;
    }

    total += Math.max(weight, 0.000001);
    cumulative.push(total);
  }

  return { cumulative, total };
}

function pickWeightedIndex(cumulative: number[], value: number): number {
  let left = 0;
  let right = cumulative.length - 1;

  while (left < right) {
    const mid = (left + right) >> 1;
    if (value <= cumulative[mid]) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  return left;
}

function buildParticleGeometry(scene: THREE.Object3D): THREE.BufferGeometry {
  scene.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.001);
  const normalizedScale = NORMALIZED_MODEL_SIZE / maxSize;

  const sources: SampledMesh[] = [];
  scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const position = mesh.geometry.getAttribute("position");
    if (!position || position.itemSize < 3 || position.count < 40) return;

    const samplerGeometry = mesh.geometry;
    samplerGeometry.computeBoundingBox();
    if (!samplerGeometry.boundingBox) return;

    const worldBounds = samplerGeometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const worldSize = worldBounds.getSize(new THREE.Vector3());
    const area = Math.max(
      0.000001,
      2 * (
        worldSize.x * worldSize.y +
        worldSize.x * worldSize.z +
        worldSize.y * worldSize.z
      )
    );

    const key = `${mesh.name ?? ""} ${materialKey(mesh.material)}`.toLowerCase();
    const samplerMesh = new THREE.Mesh(samplerGeometry);
    const sampler = new MeshSurfaceSampler(samplerMesh).build();

    sources.push({
      sampler,
      matrixWorld: mesh.matrixWorld.clone(),
      key,
      area,
    });
  });

  if (sources.length === 0) {
    throw new Error("No mesh geometry found in GLTF scene");
  }

  const explicitBodySources = sources.filter(
    (source) => source.key.includes("body") || source.key.includes("pickguard")
  );

  const bodySources =
    explicitBodySources.length > 0
      ? explicitBodySources
      : [
          sources.reduce((largest, current) =>
            current.area > largest.area ? current : largest
          ),
        ];

  const otherSources = sources.filter((source) => !bodySources.includes(source));

  const vortex = new Float32Array(PARTICLE_COUNT * 3);
  const target = new Float32Array(PARTICLE_COUNT * 3);
  const scales = new Float32Array(PARTICLE_COUNT);
  const seeds = new Float32Array(PARTICLE_COUNT);

  const sample = new THREE.Vector3();
  const TAU = Math.PI * 2;
  const rotCos = Math.cos(TARGET_ROTATION_Y);
  const rotSin = Math.sin(TARGET_ROTATION_Y);
  const bodyTargetCount =
    otherSources.length > 0 ? Math.floor(PARTICLE_COUNT * BODY_PARTICLE_SHARE) : PARTICLE_COUNT;
  const bodyWeights = buildCumulativeWeights(bodySources, "body");
  const otherWeights = buildCumulativeWeights(otherSources, "other");

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const stride = i * 3;
    const samplingBody = i < bodyTargetCount || otherSources.length === 0;
    const activeSources = samplingBody ? bodySources : otherSources;
    const activeWeights = samplingBody ? bodyWeights : otherWeights;
    const selectorSeed = samplingBody ? 41.719 : 59.311;
    const selectorValue = seededUnitFloat(i, selectorSeed) * activeWeights.total;
    const sourceIndex = pickWeightedIndex(activeWeights.cumulative, selectorValue);
    const source = activeSources[sourceIndex];

    source.sampler.sample(sample);
    sample.applyMatrix4(source.matrixWorld).sub(center).multiplyScalar(normalizedScale);

    const rotatedX = sample.x * rotCos - sample.z * rotSin;
    const rotatedZ = sample.x * rotSin + sample.z * rotCos;
    sample.x = rotatedX;
    sample.z = rotatedZ;

    target[stride] = sample.x;
    target[stride + 1] = sample.y + TARGET_OFFSET_Y;
    target[stride + 2] = sample.z * TARGET_DEPTH_SCALE;

    const seedA = seededUnitFloat(i, 53.127);
    const seedB = seededUnitFloat(i, 89.341);
    const seedC = seededUnitFloat(i, 127.993);
    const seedD = seededUnitFloat(i, 191.117);
    const seedE = seededUnitFloat(i, 223.987);

    const turns = 2.1 + seededUnitFloat(i, 173.51) * 4.8;
    const angle = seedA * TAU * turns + signedSeed(i, 257.11) * 0.42;
    const radius = 0.35 + Math.pow(seedB, 0.72) * 3.2;
    const height = signedSeed(i, 277.13) * 2.45;

    vortex[stride] = Math.cos(angle) * radius;
    vortex[stride + 1] = height;
    vortex[stride + 2] = Math.sin(angle) * radius;

    scales[i] = 0.1 + Math.pow(1 - seedE, 2.15) * 0.6;
    seeds[i] = seedD * 0.6 + seedC * 0.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vortex, 3));
  geometry.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function TelecasterParticleField({ modelUrl, mode, intensity, mouse, dragRotation }: ParticleFieldProps) {
  const gltf = useLoader(GLTFLoader, modelUrl, (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const smoothedRotation = useRef(new THREE.Vector2(0, 0));

  const geometry = useMemo(() => buildParticleGeometry(gltf.scene), [gltf.scene]);
  const uniforms = useMemo<ParticleUniforms>(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uIntensity: { value: 1 },
      uMorph: { value: 0 },
      uMode: { value: 0 },
    }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      materialRef.current?.dispose();
    },
    [geometry]
  );

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;

    const elapsed = clock.getElapsedTime();
    const phase = elapsed % CYCLE_DURATION;
    const morph =
      phase < MORPH_IN_DURATION
        ? phase / MORPH_IN_DURATION
        : phase < MORPH_IN_DURATION + HOLD_DURATION
        ? 1
        : 1 - (phase - MORPH_IN_DURATION - HOLD_DURATION) / MORPH_OUT_DURATION;

    const materialUniforms = material.uniforms as ParticleUniforms;
    materialUniforms.uTime.value = elapsed;
    materialUniforms.uMouse.value.copy(mouse.current);
    materialUniforms.uIntensity.value = Math.max(0.6, intensity);
    materialUniforms.uMorph.value = THREE.MathUtils.clamp(morph, 0, 1);
    materialUniforms.uMode.value = mode;

    if (pointsRef.current) {
      smoothedRotation.current.lerp(dragRotation.current, 0.2);
      pointsRef.current.rotation.set(
        smoothedRotation.current.x,
        DEFAULT_YAW + smoothedRotation.current.y,
        DEFAULT_ROLL
      );
    }
  });

  return (
    <group scale={[2.2, 2.2, 2.2]}>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={particleVert}
          fragmentShader={particleFrag}
          transparent
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function ParticleRig({ mode, intensity }: ParticleRigProps) {
  const mouse = useRef(new THREE.Vector2(0.5, 0.5));
  const mouseTarget = useRef(new THREE.Vector2(0.5, 0.5));
  const dragRotation = useRef(new THREE.Vector2(0, 0));
  const dragPointer = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const target = event.target;
      if (target instanceof Element && target.closest('[data-home-hero-panel="true"]')) {
        return;
      }

      dragPointer.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      mouseTarget.current.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight
      );

      const active = dragPointer.current;
      if (!active || active.pointerId !== event.pointerId) return;

      const dx = event.clientX - active.x;
      const dy = event.clientY - active.y;
      active.x = event.clientX;
      active.y = event.clientY;

      dragRotation.current.y += dx * 0.006;
      dragRotation.current.x = THREE.MathUtils.clamp(
        dragRotation.current.x + dy * 0.0042,
        -0.6,
        0.6
      );
    };

    const clearPointer = (event: PointerEvent) => {
      if (dragPointer.current?.pointerId === event.pointerId) {
        dragPointer.current = null;
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", clearPointer);
    window.addEventListener("pointercancel", clearPointer);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", clearPointer);
      window.removeEventListener("pointercancel", clearPointer);
    };
  }, []);

  useFrame(() => {
    mouse.current.lerp(mouseTarget.current, 0.06);
  });

  return (
    <Suspense fallback={null}>
      <TelecasterParticleField
        modelUrl={MODEL_URL}
        mode={mode}
        intensity={intensity}
        mouse={mouse}
        dragRotation={dragRotation}
      />
    </Suspense>
  );
}

export default function Scene({ mode = 0, intensity = 1 }: SceneProps) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 6.4], fov: 55, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.24;
      }}
    >
      <ParticleRig mode={mode} intensity={intensity} />
    </Canvas>
  );
}
