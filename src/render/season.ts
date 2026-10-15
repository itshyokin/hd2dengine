/**
 * Seasons in the shaders: grass and leaves recoloured (verdant spring, green-gold summer, orange and red autumn),
 * and winter's snow (grass under it, snow on evergreen leaves, broadleaf trees bare). Greens are found by colour
 * (green stronger than red and blue), so drawn tiles and props need no seasonal versions.
 */
import * as THREE from 'three';
import type { Season } from '../world/seasons';

const uniforms = { uHdSeason: { value: new THREE.Vector4(0, 0, 0, 0) } };

/** How a material changes: ground (grass turns to snow), leaves (snow on them), bare (leaves gone in winter). */
export type SeasonMode = 'ground' | 'leaves' | 'bare';

const HEAD = `
uniform vec4 uHdSeason;
float hdSeasonHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
vec3 hdSeasonColor(vec3 c, vec2 world, float ground, float bare, out float gone) {
  gone = 0.0;
  float g = c.g - max(c.r, c.b);
  float leaf = smoothstep(0.006, 0.05, g);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 spring = mix(c, c * vec3(0.9, 1.14, 0.82), leaf);
  vec3 summer = mix(c, vec3(lum * 1.3, lum * 1.08, lum * 0.42), leaf * 0.4);
  float h = hdSeasonHash(floor(world * 0.8));
  vec3 fall = h < 0.45 ? vec3(0.95, 0.36, 0.05) : h < 0.78 ? vec3(0.78, 0.13, 0.04) : vec3(0.42, 0.2, 0.06);
  vec3 autumn = mix(c, mix(fall * (0.25 + lum * 2.2), vec3(lum * 1.5, lum * 0.78, lum * 0.3), ground * 0.6), leaf * 0.9);
  vec3 snow = vec3(0.84, 0.89, 0.98) * (0.6 + lum * 0.5);
  vec3 winter = mix(c, snow, leaf * (ground > 0.5 ? 1.0 : 0.62));
  if (ground > 0.5) winter = mix(winter, vec3(0.8, 0.85, 0.95), 0.12);
  if (bare > 0.5 && leaf > 0.35) gone = uHdSeason.w;
  return spring * uHdSeason.x + summer * uHdSeason.y + autumn * uHdSeason.z + winter * uHdSeason.w + c * (1.0 - dot(uHdSeason, vec4(1.0)));
}
`;

/** Recolour a lit, textured material with the seasons (call after patchAreaTint: it uses its world position). */
export function patchSeason<T extends THREE.Material>(mat: T, mode: SeasonMode): T {
  if (mat.userData.hdSeason) return mat;
  mat.userData.hdSeason = mode;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = HEAD + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { float hdGone; diffuseColor.rgb = hdSeasonColor(diffuseColor.rgb, vHdWorld, ${mode === 'ground' ? '1.0' : '0.0'}, ${mode === 'bare' ? '1.0' : '0.0'}, hdGone); if (hdGone > 0.5) discard; }`);
  };
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + `|season:${mode}`;
  return mat;
}

/** Show this season everywhere (null: as drawn, no seasons). */
export function setSeason(s: Season | null): void {
  uniforms.uHdSeason.value.set(s === 'spring' ? 1 : 0, s === 'summer' ? 1 : 0, s === 'autumn' ? 1 : 0, s === 'winter' ? 1 : 0);
}
