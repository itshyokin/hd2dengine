/**
 * Sprites lean back toward the overworld camera (Database → Camera → Lean), so seen from a high camera they keep their
 * height and stand over their tile like the handheld games' sprites. Done in the vertex shader for every sprite (and
 * its shadow materials), turning about the sprite's base; battle maps set it back to upright.
 */
import * as THREE from 'three';

const uniforms = { uHdLean: { value: 0 } };

/** The lean now, in radians (0: upright). */
export function setLean(radians: number): void { uniforms.uHdLean.value = radians; }
/** The lean now (radians). */
export const leanNow = (): number => uniforms.uHdLean.value;

/**
 * Lean a separate object that belongs with a sprite standing at `base` (a weapon on its back, a fire in its hand):
 * up the leaned sprite instead of straight up, and tilted back the same. Call after placing it upright.
 */
export function leanWith(o: THREE.Object3D, base: THREE.Vector3): void {
  const a = uniforms.uHdLean.value;
  o.rotation.x = -a;
  if (!a) return;
  const dy = o.position.y - base.y;
  o.position.y = base.y + dy * Math.cos(a);
  o.position.z -= dy * Math.sin(a);
}

/** Make a sprite material lean with the camera. */
export function patchLean<T extends THREE.Material>(mat: T): T {
  if (mat.userData.hdLean) return mat;
  mat.userData.hdLean = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    // Flat on a wall (ladders, wall torches, windows): stays upright against it.
    if (mat.userData.noLean) return;
    Object.assign(shader.uniforms, uniforms);
    // Drawn leaning, but at the depth it would have standing up: terrain behind a sprite (a cliff wall, a bevel)
    // never cuts through its leaned-back top, while anything really in front of it still hides it.
    shader.vertexShader = 'uniform float uHdLean;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vec3 hdUpright = transformed;
  { float hdLy = transformed.y; transformed.y = hdLy * cos(uHdLean); transformed.z -= hdLy * sin(uHdLean); }`).replace('#include <project_vertex>', `#include <project_vertex>
  if (uHdLean > 0.0) {
    vec4 hdUp = vec4(hdUpright, 1.0);
    #ifdef USE_INSTANCING
    hdUp = instanceMatrix * hdUp;
    #endif
    hdUp = projectionMatrix * (modelViewMatrix * hdUp);
    gl_Position.z = hdUp.z / hdUp.w * gl_Position.w;
  }`);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + (mat.userData.noLean ? '|nolean' : '|lean');
  return mat;
}
