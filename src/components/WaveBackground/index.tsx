import { useEffect, useRef } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import useBaseUrl from '@docusaurus/useBaseUrl';

function createBoat(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-12, 0);
  hullShape.lineTo(12, 0);
  hullShape.lineTo(15, 4.5);
  hullShape.lineTo(-14, 4.5);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 6,
    bevelEnabled: false,
  });
  hullGeo.translate(0, 0, -3);
  g.add(new THREE.Mesh(hullGeo, mat));

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 5), mat);
  cabin.position.set(-7, 7, 0);
  g.add(cabin);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 16, 6), mat);
  mast.position.set(4, 12, 0);
  g.add(mast);

  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 13, 6), mat);
  boom.position.set(-2, 11, 0);
  boom.rotation.z = 0.9;
  g.add(boom);

  const personMat = new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 1.4), personMat);
  torso.position.set(8, 6, 0);
  torso.rotation.z = -0.12;
  g.add(torso);

  const legs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.4), personMat);
  legs.position.set(9.4, 4.9, 0);
  g.add(legs);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), personMat);
  head.position.set(8.2, 8.1, 0);
  g.add(head);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.8, 10), personMat);
  hat.position.set(8.2, 8.8, 0);
  g.add(hat);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.6), personMat);
  arm.position.set(9.3, 6.6, 0);
  arm.rotation.z = -0.3;
  g.add(arm);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 9, 5), personMat);
  rod.position.set(13, 8.2, 0);
  rod.rotation.z = -1.1;
  g.add(rod);

  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 11, 4), personMat);
  line.position.set(17, 4.5, 0);
  g.add(line);

  return g;
}

function createCloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const puffs: Array<[number, number, number]> = [
    [128, 150, 72],
    [78, 160, 52],
    [182, 156, 56],
    [108, 122, 46],
    [162, 126, 42],
  ];
  for (const [x, y, r] of puffs) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

type DolphinState = {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  dir: 1 | -1;
  period: number;
  phase: number;
  height: number;
  span: number;
  mixer?: THREE.AnimationMixer;
};

const JUMP_DURATION = 1.7;

const DOLPHIN_MODELS: Array<{ file: string; rotationY: number; length: number }> = [
  { file: 'dolphin.glb', rotationY: -Math.PI / 2, length: 9 },
  { file: 'Shark.glb',   rotationY: Math.PI / 2, length: 10 },
];

export default function WaveBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const normalsUrl = useBaseUrl('/img/waternormals.jpg');
  const modelsBase = useBaseUrl('/models/');
  const { colorMode } = useColorMode();
  const isDarkRef = useRef(colorMode === 'dark');

  useEffect(() => {
    isDarkRef.current = colorMode === 'dark';
  }, [colorMode]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDarkRef.current ? 0.45 : 0.38;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 1, 20000);
    camera.position.set(0, 12, 120);

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load(normalsUrl, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: isDarkRef.current ? 0x0f3350 : 0x004d70,
      distortionScale: 3.7,
      fog: false,
    });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const sceneEnv = new THREE.Scene();
    const sun = new THREE.Vector3();
    let renderTarget: THREE.WebGLRenderTarget | undefined;

    const updateSun = (elevation: number, azimuth: number) => {
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(azimuth);
      sun.setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(sun);
      water.material.uniforms['sunDirection'].value.copy(sun).normalize();
      if (renderTarget) renderTarget.dispose();
      sceneEnv.add(sky);
      renderTarget = pmremGenerator.fromScene(sceneEnv);
      scene.add(sky);
      scene.environment = renderTarget.texture;
    };

    // ── 星星：夜晚顯示 ──
    const STAR_COUNT = 2000;
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48; // 上半球
      const r = 9000;
      starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 500;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      sizeAttenuation: false,
      transparent: true,
      opacity: isDarkRef.current ? 1 : 0,
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.visible = isDarkRef.current;
    scene.add(stars);

    // ── 月亮（Sprite：永遠面向鏡頭，永遠是正圓）──
    // 月盤：crisp 亮圓 + 邊緣柔化
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 256; moonCanvas.height = 256;
    const mc = moonCanvas.getContext('2d')!;
    // 外光暈
    const outerGlow = mc.createRadialGradient(128, 128, 30, 128, 128, 128);
    outerGlow.addColorStop(0,   'rgba(255,252,200,0.18)');
    outerGlow.addColorStop(0.5, 'rgba(255,252,200,0.06)');
    outerGlow.addColorStop(1,   'rgba(255,252,200,0)');
    mc.fillStyle = outerGlow;
    mc.fillRect(0, 0, 256, 256);
    // 月盤本體（純白偏暖，清晰圓邊）
    mc.beginPath();
    mc.arc(128, 128, 36, 0, Math.PI * 2);
    mc.fillStyle = '#fffce0';
    mc.fill();
    // 邊緣柔化
    const edgeGlow = mc.createRadialGradient(128, 128, 28, 128, 128, 40);
    edgeGlow.addColorStop(0,   'rgba(255,255,255,0)');
    edgeGlow.addColorStop(1,   'rgba(255,252,200,0.5)');
    mc.fillStyle = edgeGlow;
    mc.beginPath();
    mc.arc(128, 128, 40, 0, Math.PI * 2);
    mc.fill();
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex,
      transparent: true,
      opacity: isDarkRef.current ? 1 : 0,
      depthWrite: false,
      toneMapped: false, // 不受夜晚低曝光影響，保持月亮明亮
    }));
    moonSprite.position.set(2800, 1800, -4500);
    moonSprite.scale.set(400, 400, 1);
    moonSprite.visible = isDarkRef.current;
    scene.add(moonSprite);

    // 月亮大光暈（更大更柔）
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128; glowCanvas.height = 128;
    const gc = glowCanvas.getContext('2d')!;
    const gg = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0,   'rgba(255,248,200,0.55)');
    gg.addColorStop(0.35,'rgba(255,248,200,0.20)');
    gg.addColorStop(1,   'rgba(255,248,200,0)');
    gc.fillStyle = gg;
    gc.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: isDarkRef.current ? 0.9 : 0,
      depthWrite: false,
      toneMapped: false,
    }));
    moonGlow.position.copy(moonSprite.position);
    moonGlow.scale.set(900, 900, 1);
    moonGlow.visible = isDarkRef.current;
    scene.add(moonGlow);

    // 月光（方向光）
    const moonLight = new THREE.DirectionalLight(0x8898cc, isDarkRef.current ? 0.3 : 0);
    moonLight.position.set(2800, 1800, -4500);
    scene.add(moonLight);

    // 夜晚環境光（讓船和海豚不會完全黑掉）
    const nightAmbient = new THREE.AmbientLight(0x1a2a4a, isDarkRef.current ? 0.5 : 0);
    scene.add(nightAmbient);

    // 顏色插值用的 Color 物件
    const dayWaterColor   = new THREE.Color(0x004d70);
    const nightWaterColor = new THREE.Color(0x0f3350);
    const lerpedColor     = new THREE.Color();

    // nightT：0 = 白天，1 = 夜晚
    let nightT = isDarkRef.current ? 1 : 0;
    let lastSunElevation = isDarkRef.current ? 1.5 : 25;

    // 根據目前 nightT 設好天空、太陽（白天 = 柔和晨光，夜晚 = 傍晚 6 點半的暮色）
    skyUniforms['turbidity'].value      = THREE.MathUtils.lerp(4,      10,     nightT);
    skyUniforms['rayleigh'].value       = THREE.MathUtils.lerp(2.5,    1.5,    nightT);
    skyUniforms['mieCoefficient'].value = THREE.MathUtils.lerp(0.001, 0.0005, nightT);
    skyUniforms['mieDirectionalG'].value = 0.7;
    updateSun(lastSunElevation, isDarkRef.current ? 235 : 252);

    // ── 漁船 ──
    const silhouetteMat = new THREE.MeshStandardMaterial({
      color: 0x4a4036,
      roughness: 0.9,
      metalness: 0,
    });
    const boat = createBoat(silhouetteMat);
    boat.position.set(-130, 0, -240);
    boat.scale.setScalar(1.4);
    scene.add(boat);

    // ── 海豚群 ──
    const dolphins: DolphinState[] = [
      { baseX: 45,  baseZ: -70,  dir: 1,  period: 7, phase: 0,   height: 7, span: 16 },
      { baseX: 75,  baseZ: -115, dir: 1,  period: 9, phase: 3,   height: 8, span: 20 },
      { baseX: 20,  baseZ: -95,  dir: -1, period: 8, phase: 5.2, height: 6, span: 14 },
    ].map((d) => {
      const group = new THREE.Group();
      group.scale.setScalar(1.5);
      group.visible = false;
      scene.add(group);
      return { ...d, group } as DolphinState;
    });

    const loader = new GLTFLoader();
    const templates: Array<{ wrapper: THREE.Group; clips: THREE.AnimationClip[] }> = [];
    const assignRandomModel = (d: DolphinState) => {
      if (templates.length === 0) return;
      d.mixer?.stopAllAction();
      d.mixer = undefined;
      d.group.clear();
      const pick = templates[Math.floor(Math.random() * templates.length)];
      const instance = cloneSkeleton(pick.wrapper) as THREE.Group;
      d.group.add(instance);
      if (pick.clips.length > 0) {
        const clip =
          pick.clips.find((c) => /Swim(?!_)/.test(c.name) && !c.name.includes('Bite')) ??
          pick.clips[0];
        d.mixer = new THREE.AnimationMixer(instance);
        d.mixer.clipAction(clip).play();
      }
    };
    for (const cfg of DOLPHIN_MODELS) {
      loader.load(modelsBase + cfg.file, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.scale.setScalar(cfg.length / Math.max(size.x, size.y, size.z));
        wrapper.rotation.y = cfg.rotationY;
        templates.push({ wrapper, clips: gltf.animations });

        for (const d of dolphins) {
          if (d.group.children.length === 0) assignRandomModel(d);
        }
      });
    }

    // ── 白雲（白天顯示）──
    const cloudTexture = createCloudTexture();
    const clouds: Array<{ sprite: THREE.Sprite; speed: number; baseOpacity: number }> = [];
    for (let i = 0; i < 10; i++) {
      const baseOpacity = 0.5 + Math.random() * 0.35;
      const cloudMat = new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: baseOpacity * (isDarkRef.current ? 0 : 1),
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(cloudMat);
      const scale = 220 + Math.random() * 280;
      sprite.scale.set(scale, scale * 0.45, 1);
      sprite.position.set(
        -1000 + Math.random() * 2000,
        130 + Math.random() * 220,
        -700 - Math.random() * 600,
      );
      scene.add(sprite);
      clouds.push({ sprite, speed: 2 + Math.random() * 3, baseOpacity });
    }

    const clock = new THREE.Clock();
    let id: number;
    let prevT = 0;

    const tick = () => {
      id = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const dt = t - prevT;
      prevT = t;
      water.material.uniforms['time'].value = t * 0.5;

      // ── 日夜切換平滑過渡 ──
      const target = isDarkRef.current ? 1 : 0;
      nightT += (target - nightT) * Math.min(dt * 1.2, 1);

      if (Math.abs(nightT - target) > 0.001) {
        // 更新天空參數
        skyUniforms['turbidity'].value      = THREE.MathUtils.lerp(4,      10,     nightT);
        skyUniforms['rayleigh'].value       = THREE.MathUtils.lerp(2.5,    1.5,    nightT);
        skyUniforms['mieCoefficient'].value = THREE.MathUtils.lerp(0.001, 0.0005, nightT);

        // 太陽高度（夜晚 = 太陽剛貼在地平線上的黃昏）
        // 白天方位偏正左（252°），讓光暈大多落在畫面外
        const elevation = THREE.MathUtils.lerp(25, 1.5, nightT);
        if (Math.abs(elevation - lastSunElevation) > 1.5) {
          updateSun(elevation, THREE.MathUtils.lerp(252, 235, nightT));
          lastSunElevation = elevation;
        }

        // 曝光
        renderer.toneMappingExposure = THREE.MathUtils.lerp(0.38, 0.45, nightT);

        // 水色
        lerpedColor.copy(dayWaterColor).lerp(nightWaterColor, nightT);
        water.material.uniforms['waterColor'].value.copy(lerpedColor);
      }

      // 星星與月亮
      starMat.opacity = nightT;
      stars.visible = nightT > 0.02;

      const moonOpacity = Math.max(0, (nightT - 0.3) * (1 / 0.7));
      moonSprite.visible = moonOpacity > 0.01;
      (moonSprite.material as THREE.SpriteMaterial).opacity = moonOpacity;
      (moonGlow.material as THREE.SpriteMaterial).opacity = moonOpacity * 0.9;
      moonGlow.visible = moonOpacity > 0.01;
      moonLight.intensity = moonOpacity * 0.6;
      nightAmbient.intensity = nightT * 0.7;

      // 白雲淡出（夜晚）
      for (const c of clouds) {
        (c.sprite.material as THREE.SpriteMaterial).opacity = c.baseOpacity * (1 - nightT);
        c.sprite.position.x += c.speed * dt;
        if (c.sprite.position.x > 1100) c.sprite.position.x = -1100;
      }

      // 漁船隨波起伏
      boat.position.y = Math.sin(t * 0.6) * 0.5 + Math.sin(t * 0.23) * 0.3;
      boat.position.x = -130 + Math.sin(t * 0.02) * 12;
      boat.rotation.z = Math.sin(t * 0.5) * 0.04;
      boat.rotation.x = Math.sin(t * 0.35 + 1) * 0.03;

      // 海豚拋物線跳躍
      for (const d of dolphins) {
        const cycle = (t + d.phase) % d.period;
        const p = cycle / JUMP_DURATION;
        if (p <= 1) {
          d.group.visible = true;
          const x = d.baseX + d.dir * d.span * (p - 0.5);
          const y = -2.5 + Math.sin(p * Math.PI) * (d.height + 2.5);
          d.group.position.set(x, y, d.baseZ);
          const vy = Math.PI * Math.cos(p * Math.PI) * (d.height + 2.5);
          const pitch = Math.atan2(vy, d.span / JUMP_DURATION);
          d.group.scale.x = 1.5 * d.dir;
          d.group.rotation.z = d.dir === 1 ? pitch : -pitch;
          d.mixer?.update(dt);
        } else if (d.group.visible) {
          d.group.visible = false;
          assignRandomModel(d);
        }
      }

      // 鏡頭微漂移
      camera.position.x = Math.sin(t * 0.05) * 6;
      camera.position.y = 12 + Math.sin(t * 0.08) * 1.0;
      camera.lookAt(0, 9, 0);
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      el.removeChild(renderer.domElement);
      if (renderTarget) renderTarget.dispose();
      pmremGenerator.dispose();
      starGeo.dispose();
      starMat.dispose();
      moonTex.dispose();
      (moonSprite.material as THREE.SpriteMaterial).dispose();
      glowTex.dispose();
      (moonGlow.material as THREE.SpriteMaterial).dispose();
      for (const c of clouds) c.sprite.material.dispose();
      cloudTexture.dispose();
      const seen = new Set<object>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (!seen.has(obj.geometry)) { seen.add(obj.geometry); obj.geometry.dispose(); }
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (!seen.has(m)) { seen.add(m); m.dispose(); }
          }
        }
      });
      renderer.dispose();
    };
  }, [normalsUrl, modelsBase]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    />
  );
}
