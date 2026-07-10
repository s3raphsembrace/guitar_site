"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { useLoggedGltf } from "./useLoggedGltf";

const MODEL_URL = "/models/telecaster/telecaster_web.glb";
const DEBUG_MODEL_SCALE = 1;
// Temporary tuning values for centering/scaling the raw GLB in this debug view.
const DEBUG_MODEL_POSITION: [number, number, number] = [0, -0.36, 0];

function OrbitControlsRig() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const controls = new OrbitControlsImpl(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    return () => {
      controls.dispose();
    };
  }, [camera, gl]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

function TelecasterPrimitive() {
  const { gltf, error } = useLoggedGltf(MODEL_URL, "TelecasterDebugScene");
  const clonedScene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf]);

  if (error) return null;
  if (!clonedScene) return null;

  return (
    <primitive
      object={clonedScene}
      scale={DEBUG_MODEL_SCALE}
      position={DEBUG_MODEL_POSITION}
    />
  );
}

export default function TelecasterModelDebug() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.42, 3.2], fov: 48, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x06080e, 1);
      }}
    >
      <ambientLight intensity={0.62} />
      <hemisphereLight intensity={0.3} color="#c7d2fe" groundColor="#0b1220" />
      <directionalLight position={[4, 5, 3]} intensity={1.05} color="#ffffff" />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} color="#93c5fd" />
      <gridHelper args={[8, 16, "#1f2937", "#111827"]} />
      <axesHelper args={[1.4]} />
      <TelecasterPrimitive />
      <OrbitControlsRig />
    </Canvas>
  );
}
