"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

function countMeshes(scene: THREE.Object3D): number {
  let meshCount = 0;

  scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      meshCount += 1;
    }
  });

  return meshCount;
}

function normalizeLoadError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

export function useLoggedGltf(modelUrl: string, label: string): { gltf: GLTF | null; error: Error | null } {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();

    console.info(`[${label}] Loading model`, { url: modelUrl });

    loader.load(
      modelUrl,
      (loadedGltf) => {
        if (cancelled) return;

        console.info(`[${label}] Model loaded`, {
          url: modelUrl,
          meshCount: countMeshes(loadedGltf.scene),
          childCount: loadedGltf.scene.children.length,
        });
        setGltf(loadedGltf);
        setError(null);
      },
      undefined,
      (loadError) => {
        if (cancelled) return;

        const normalizedError = normalizeLoadError(loadError);
        console.error(`[${label}] Failed to load model`, { url: modelUrl }, normalizedError);
        setError(normalizedError);
        setGltf(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [label, modelUrl]);

  return { gltf, error };
}
