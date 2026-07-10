"use client";

import * as THREE from "three";
import { extend, type ThreeElement } from "@react-three/fiber";

const vert = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uIntensity;
  uniform int uMode;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x)
      + (c - a) * u.y * (1.0 - u.x)
      + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }

    return value;
  }

  float streaks(vec2 uv, float angle, float frequency, float width) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 rotation = mat2(c, -s, s, c);
    vec2 p = rotation * (uv - 0.5);
    float bands = abs(sin(p.x * frequency));
    return smoothstep(1.0 - width, 1.0, bands);
  }

  float grid(vec2 uv, float scale) {
    vec2 g = fract(uv * scale);
    float line = min(abs(g.x - 0.5), abs(g.y - 0.5));
    return smoothstep(0.02, 0.0, line);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv - 0.5;
    p.x *= uResolution.x / uResolution.y;

    vec2 mouseParallax = (uMouse - 0.5) * 0.08;
    p += mouseParallax;

    float t = uTime;

    float drift = fbm(p * 2.0 + vec2(0.0, t * 0.05));

    vec2 warped = p
      + 0.25 * vec2(
        fbm(p * 3.0 + t * 0.12),
        fbm(p * 3.0 - t * 0.10)
      );

    float ridges = 1.0 - abs(2.0 * fbm(warped * 4.0 + t * 0.06) - 1.0);
    ridges = pow(ridges, 3.0);

    float s1 = streaks(uv, 0.45 + drift * 0.5, 22.0, 0.08);
    float s2 = streaks(uv, -0.9 + drift * 0.4, 18.0, 0.10);
    float s3 = streaks(uv, 1.4, 28.0, 0.06);
    float streak = s1 + s2 + 0.5 * s3;

    float radius = length(p);
    float core = smoothstep(0.35, 0.0, radius);
    core *= 0.6 + 0.4 * sin(t * 0.8 + drift * 6.0);

    float energy = 0.25 * drift + 0.65 * ridges + 0.45 * streak + 0.9 * core;

    float shimmer = noise(p * 40.0 + t * 2.0);
    energy += 0.12 * shimmer * smoothstep(0.55, 1.0, energy);

    float g1 = grid(uv, 18.0);
    float g2 = grid(uv + vec2(0.02 * sin(t * 0.2), 0.0), 60.0);
    float scan = 0.5 + 0.5 * sin((uv.y + t * 0.08) * 140.0);
    float hud = 0.06 * g1 + 0.03 * g2 + 0.02 * scan;

    vec3 dark = vec3(0.03, 0.04, 0.04);
    vec3 teal = vec3(0.55, 0.85, 0.85);
    vec3 ice = vec3(0.78, 0.88, 0.98);

    float e = clamp(energy, 0.0, 1.0);
    vec3 color = mix(dark, teal, e);
    color = mix(color, ice, smoothstep(0.65, 1.0, e));

    if (uMode == 1) {
      color = vec3(1.0) - color;
      color = mix(color, vec3(dot(color, vec3(0.333))), 0.25);
    } else {
      color = mix(color, vec3(dot(color, vec3(0.333))), 0.18);
    }

    color += hud;
    color = pow(color, vec3(1.1));
    color *= uIntensity;

    gl_FragColor = vec4(color, 1.0);
  }
`;

type CyberMetalUniforms = {
  uTime: THREE.IUniform<number>;
  uResolution: THREE.IUniform<THREE.Vector2>;
  uMouse: THREE.IUniform<THREE.Vector2>;
  uIntensity: THREE.IUniform<number>;
  uMode: THREE.IUniform<number>;
};

export class CyberMetalMaterial extends THREE.ShaderMaterial {
  declare uniforms: CyberMetalUniforms;

  constructor() {
    super({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uIntensity: { value: 1 },
        uMode: { value: 0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
    });
  }

  get uTime() {
    return this.uniforms.uTime.value;
  }

  set uTime(value: number) {
    this.uniforms.uTime.value = value;
  }

  get uResolution() {
    return this.uniforms.uResolution.value;
  }

  set uResolution(value: THREE.Vector2) {
    this.uniforms.uResolution.value = value;
  }

  get uMouse() {
    return this.uniforms.uMouse.value;
  }

  set uMouse(value: THREE.Vector2) {
    this.uniforms.uMouse.value = value;
  }

  get uIntensity() {
    return this.uniforms.uIntensity.value;
  }

  set uIntensity(value: number) {
    this.uniforms.uIntensity.value = value;
  }

  get uMode() {
    return this.uniforms.uMode.value;
  }

  set uMode(value: number) {
    this.uniforms.uMode.value = value;
  }
}

extend({ CyberMetalMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    cyberMetalMaterial: ThreeElement<typeof CyberMetalMaterial>;
  }
}
