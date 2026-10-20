/**
 * Sprites lean back toward the overworld camera (Database → Camera → Lean), so seen from a high camera they keep their
 * height and stand over their tile like the handheld games' sprites. Done in the vertex shader for every sprite (and
 * its shadow materials), turning about the sprite's base; battle maps set it back to upright.
 */
import * as THREE from 'three';

const uniforms = { uHdLean: { value: 0 } };

/** The lean now, in radians (0: upright). */
export function setLean(radians: number): void { uniforms.uHdLean.value = radians; }

/** Make a sprite material lean with the camera. */
export function patchLean<T extends THREE.Material>(mat: T): T {
  if (mat.userData.hdLean) return mat;
  mat.userData.hdLean = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float uHdLean;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { float hdLy = transformed.y; transformed.y = hdLy * cos(uHdLean); transformed.z -= hdLy * sin(uHdLean); }`);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|lean';
  return mat;
}
