import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x090b0c, 11, 25);
const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
camera.position.set(0, 2.2, 11);
scene.add(new THREE.HemisphereLight(0xddeeff, 0x101316, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 5); key.position.set(4, 7, 6); key.castShadow = true; scene.add(key);
const green = new THREE.PointLight(0x00ffa3, 45, 12); green.position.set(-4, 2, 3); scene.add(green);
const root = new THREE.Group(); scene.add(root);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: 0x111517, roughness: .84, metalness: .16 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.3; floor.receiveShadow = true; scene.add(floor);

function clear(){ while(root.children.length) root.remove(root.children[0]); }
function kuji(){
  clear();
  const box = new THREE.Mesh(new THREE.BoxGeometry(4.8,3.5,3.3),new THREE.MeshStandardMaterial({color:0x171c1e,metalness:.38,roughness:.4})); box.castShadow=true; root.add(box);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(2.8,.2,.5),new THREE.MeshStandardMaterial({color:0x00ffa3,emissive:0x00774d,emissiveIntensity:2})); slot.position.set(0,1.25,1.65); root.add(slot);
  for(let i=0;i<10;i++){const ticket=new THREE.Mesh(new THREE.BoxGeometry(.72,.92,.12),new THREE.MeshStandardMaterial({color:i===3?0xffd438:0xe8eeeb,roughness:.65}));ticket.position.set((i%5-2)*.86,-.65+Math.floor(i/5)*1.02,1.7);ticket.rotation.z=(i%3-1)*.04;ticket.castShadow=true;root.add(ticket)}
  root.rotation.y=-.32;
}
function roulette(){
  clear();
  const wheel=new THREE.Group(); const count=10;
  for(let i=0;i<count;i++){const shape=new THREE.Shape();shape.moveTo(0,0);shape.absarc(0,0,3,i/count*Math.PI*2,(i+1)/count*Math.PI*2,false);shape.lineTo(0,0);const segment=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:i%2?0x00ffa3:0x263036,metalness:.2,roughness:.52}));wheel.add(segment)}
  wheel.rotation.x=-.12;wheel.rotation.z=.18;root.add(wheel);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.7,32),new THREE.MeshStandardMaterial({color:0xffd438,metalness:.65,roughness:.25}));hub.rotation.x=Math.PI/2;hub.position.z=.52;root.add(hub);
}
let mode='kuji'; kuji();
document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{document.querySelector('.active')?.classList.remove('active');button.classList.add('active');mode=(button as HTMLElement).dataset.mode!;if(mode==='kuji'){kuji();document.querySelector('#title')!.textContent='이치방쿠지 추첨';document.querySelector('#eyebrow')!.textContent='ICHIBAN KUJI';document.querySelector('#result')!.textContent='A상 · 한정판 피규어'}else{roulette();document.querySelector('#title')!.textContent='후원 룰렛';document.querySelector('#eyebrow')!.textContent='DONATION ROULETTE';document.querySelector('#result')!.textContent='당첨 · 랜덤 미션'}}));
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
let previous=0;function render(time:number){const delta=Math.min((time-previous)/1000,.04);previous=time;if(mode==='roulette')root.rotation.z-=delta*.28;else root.rotation.y=-.32+Math.sin(time*.0006)*.08;renderer.render(scene,camera);requestAnimationFrame(render)}requestAnimationFrame(render);
