import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import kujiModelUrl from '../assets/models/kuji-machine.glb?url';
import rouletteModelUrl from '../assets/models/roulette.glb?url';

export function LotteryModel3D({ mode }: { mode: 'kuji' | 'roulette' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setSize(760, 760, false);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(34, 1, .1, 100); camera.position.set(5.8, 7.5, 5.2); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xeafff5, 0x101817, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 4.5); key.position.set(4, 6, 7); scene.add(key);
    const accent = new THREE.PointLight(0x00ffa3, 28, 16); accent.position.set(-4, 1, 4); scene.add(accent);
    let model: THREE.Group | null = null; let mixer: THREE.AnimationMixer | null = null; let frame = 0; let disposed = false;
    new GLTFLoader().load(mode === 'kuji' ? kujiModelUrl : rouletteModelUrl, (gltf) => {
      if (disposed) return; model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
      model.position.sub(center); model.scale.setScalar((mode === 'kuji' ? 5.2 : 5.5) / Math.max(size.x, size.y, size.z)); scene.add(model);
      if (gltf.animations.length) { mixer = new THREE.AnimationMixer(model); gltf.animations.forEach((clip) => { const action = mixer!.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); }); }
    });
    const startedAt = performance.now(); let previousAt = startedAt;
    const render = (now: number) => { if (disposed) return; const delta = Math.min((now - previousAt) / 1000, .04); previousAt = now; mixer?.update(delta); if (model && mode === 'kuji') model.rotation.y = Math.sin((now - startedAt) / 1000 * .7) * .12; renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render);
    return () => { disposed = true; cancelAnimationFrame(frame); mixer?.stopAllAction(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose()); } }); renderer.dispose(); };
  }, [mode]);
  return <div className={`lottery-model-3d ${mode}`}><canvas ref={canvasRef} width={760} height={760} /></div>;
}
