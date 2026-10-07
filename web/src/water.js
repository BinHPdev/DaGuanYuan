// Water surface: fresnel sky reflection, animated ripple normals, sun glint.
import * as THREE from 'three';

export function buildWater(sunDir) {
  const geo = new THREE.PlaneGeometry(420, 360, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSun: { value: sunDir.clone() },
        uDeep: { value: new THREE.Color('#2e5a52') },
        uShallow: { value: new THREE.Color('#5f8f78') },
        uSky: { value: new THREE.Color('#b9d0dc') },
        uSnow: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform float uSnow;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      vec2 wave(vec2 p, vec2 dir, float freq, float speed) {
        float ph = dot(p, dir) * freq + uTime * speed;
        return dir * cos(ph) * freq;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec2 g = wave(p, normalize(vec2(1.0, 0.3)), 0.9, 1.3) * 0.05
               + wave(p, normalize(vec2(-0.4, 1.0)), 1.7, 1.9) * 0.03
               + wave(p, normalize(vec2(0.7, -0.8)), 3.1, 2.7) * 0.015
               + wave(p, normalize(vec2(-0.9, -0.2)), 5.3, 3.3) * 0.008;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 base = mix(uDeep, uShallow, 0.35 + 0.25 * sin(p.x * 0.05) * sin(p.y * 0.04));
        vec3 sky = mix(uSky, vec3(0.92), uSnow * 0.5);
        vec3 col = mix(base, sky, 0.15 + 0.75 * fres);
        vec3 h = normalize(normalize(uSun) + v);
        col += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 220.0) * 1.4;
        gl_FragColor = vec4(col, 0.86 + 0.12 * fres);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.name = 'water';
  mesh.renderOrder = 1;
  return mesh;
}
