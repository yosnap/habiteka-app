import { describe, expect, it } from 'vitest';
import { CanvasTexture, Vector4, type WebGLProgramParametersWithUniforms } from 'three';
import { clipShaderToZone } from '@/components/editor-v2/scene/zone-scene-isolation';

describe('captura de una zona aislada', () => {
  it('descarta antes de pintar y de ocupar profundidad la geometría ajena a la zona', () => {
    const shader = {
      uniforms: {},
      vertexShader: 'void main() { vec3 transformed = position; #include <project_vertex> }',
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    } as WebGLProgramParametersWithUniforms;
    const texture = new CanvasTexture();
    const bounds = new Vector4(0, 0, 4, 4);
    clipShaderToZone(shader, texture, bounds);
    expect(shader.vertexShader).toContain('vHabitekaZoneWorld = (modelMatrix * habitekaZoneLocal).xyz;');
    expect(shader.fragmentShader.indexOf('discard;')).toBeLessThan(shader.fragmentShader.indexOf('gl_FragColor'));
    expect(shader.uniforms.habitekaZoneMap?.value).toBe(texture);
    expect(shader.uniforms.habitekaZoneBounds?.value).toBe(bounds);
  });
});
