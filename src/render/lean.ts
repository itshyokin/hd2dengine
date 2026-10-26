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
    if (mat.userData.noLean) {
      // Not drawn in front of tiles: pushed back like the ground, so it sorts with it as it really stands.
      if (mat.userData.hdBack) { Object.assign(shader.uniforms, uniforms); shader.vertexShader = 'uniform float uHdLean;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  if (uHdLean > 0.0) {
    vec4 hdBack = projectionMatrix * vec4(mvPosition.xyz * (1.0 + ${GROUND_YIELD.toFixed(2)} / max(0.001, length(mvPosition.xyz))), 1.0);
    gl_Position.z = hdBack.z / hdBack.w * gl_Position.w;
  }`); }
      return;
    }
    Object.assign(shader.uniforms, uniforms);
    // A prop set not to be drawn in front of tiles (PropDef.frontOfTiles false) is pushed back as far as the ground is.
    const back = mat.userData.hdBack ? `hdUp.xyz *= 1.0 + ${GROUND_YIELD.toFixed(2)} / max(0.001, length(hdUp.xyz));` : '';
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
    hdUp = modelViewMatrix * hdUp;
    ${back}
    hdUp = projectionMatrix * hdUp;
    gl_Position.z = hdUp.z / hdUp.w * gl_Position.w;
  }`);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + (mat.userData.noLean ? '|nolean' : '|lean') + (mat.userData.hdBack ? '|back' : '');
  return mat;
}

/** How far terrain is pushed back in depth on the map (world units): characters and props a ledge would hide show. */
export const GROUND_YIELD = 3.5;

/**
 * Terrain on the map (ground, cliff walls, water, the scenery round the edge) gives way to characters and props:
 * it's drawn where it is, but GROUND_YIELD further from the camera in depth, so a sprite just behind a ledge or
 * against a tall cliff stays in view like the handheld games (nothing hides behind the ground). Off on battle maps
 * (no lean there). Ground still hides ground, in order, and buildings aren't pushed (walking behind a house hides you).
 */
export function patchGroundYield<T extends THREE.Material>(mat: T): T {
  if (mat.userData.hdYield) return mat;
  mat.userData.hdYield = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    if (!shader.vertexShader.includes('#include <project_vertex>')) return;
    shader.vertexShader = (shader.vertexShader.includes('uniform float uHdLean;') ? '' : 'uniform float uHdLean;\n') + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  if (uHdLean > 0.0) {
    vec4 hdBack = projectionMatrix * vec4(mvPosition.xyz * (1.0 + ${GROUND_YIELD.toFixed(2)} / max(0.001, length(mvPosition.xyz))), 1.0);
    gl_Position.z = hdBack.z / hdBack.w * gl_Position.w;
  }`);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|yield';
  return mat;
}

/** The stencil value props write (Update 139). */
export const PROP_STENCIL = 1;
/** Mark a prop material so characters set always on top draw over it. */
export function markProp(m: THREE.Material | THREE.Material[]): void {
  for (const x of Array.isArray(m) ? m : [m]) { x.stencilWrite = true; x.stencilRef = PROP_STENCIL; x.stencilFunc = THREE.AlwaysStencilFunc; x.stencilZPass = THREE.ReplaceStencilOp; }
}
