// Loads the AI-generated (Tripo image-to-3D) props and fits them to the requested slots.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { rock } from './arch.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = {};
const BRIGHT = new Set(['paifang', 'shishi']); // white marble/jade pieces come out too grey

function load(name) {
  return (cache[name] ||= loader.loadAsync(`./models/${name}.json`).then((g) => {
    const s = g.scene;
    s.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
        if (o.material) { o.material.roughness = Math.max(o.material.roughness ?? 1, 0.7); o.material.metalness = 0; o.material.metalnessMap = null; if (BRIGHT.has(name)) o.material.color.multiplyScalar(1.5); }
      }
    });
    const box = new THREE.Box3().setFromObject(s);
    return { scene: s, box };
  }).catch((e) => { console.warn('prop failed', name, e); return null; }));
}

// Per-model footprint tweaks: some generated meshes need to be wider than tall.
const FIT = { cuizhang: { widthOverHeight: 3.3 }, paifang: { }, fang: { byLength: 9 } };

export async function placeProps(slots, parent) {
  const group = new THREE.Group(); group.name = 'props';
  parent.add(group);
  await Promise.all(slots.map(async (s) => {
    const res = await load(s.model);
    let obj;
    if (res) {
      obj = res.scene.clone(true);
      const size = res.box.getSize(new THREE.Vector3());
      let k = s.height / size.y;
      if (FIT[s.model]?.byLength) k = FIT[s.model].byLength / Math.max(size.x, size.z);
      obj.scale.setScalar(k);
      if (FIT[s.model]?.widthOverHeight) obj.scale.x = obj.scale.z = (s.height * FIT[s.model].widthOverHeight) / Math.max(size.x, size.z);
      const c = res.box.getCenter(new THREE.Vector3());
      obj.position.set(-c.x * obj.scale.x, -res.box.min.y * obj.scale.y, -c.z * obj.scale.z);
      if (s.floating) obj.position.y -= size.y * obj.scale.y * 0.18;
      const holder = new THREE.Group(); holder.add(obj); obj = holder;
    } else {
      obj = rock(s.height / 2, 7);
    }
    obj.position.set(s.x, s.y - (s.floating ? 0 : 0.1), s.z);
    obj.rotation.y = (s.rot || 0) - Math.PI / 2; // Tripo meshes face +x; turn them to face +z
    obj.userData.place = s.place;
    group.add(obj);
  }));
  return group;
}
