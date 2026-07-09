// Real interactive 3D earth for the hero panel, built with Three.js.
// Falls back to the plain CSS gradient sphere (see .globe in styles.css)
// if WebGL or the module CDN is unavailable.
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const mount = document.getElementById('earth3d');
const panel = document.getElementById('routePanel');
if (mount && panel) {
  initEarth(mount, panel).catch(() => {
    // leave the CSS fallback sphere visible
  });
}

async function initEarth(mount, panel) {
  let width = mount.clientWidth;
  let height = mount.clientHeight;
  if (!width || !height) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cursor = 'grab';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 2.6;

  const loader = new THREE.TextureLoader();
  const [colorMap, normalMap, specularMap] = await Promise.all([
    loadTexture(loader, 'assets/earth/color.jpg'),
    loadTexture(loader, 'assets/earth/normal.jpg'),
    loadTexture(loader, 'assets/earth/specular.jpg')
  ]);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshPhongMaterial({
      map: colorMap,
      normalMap: normalMap,
      specularMap: specularMap,
      specular: new THREE.Color(0x3a2a66),
      shininess: 9
    })
  );
  scene.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x9d4edd, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  scene.add(atmosphere);

  scene.add(new THREE.AmbientLight(0x8866cc, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(-2, 1.2, 2);
  scene.add(key);
  const rim = new THREE.PointLight(0x9d4edd, 1.3, 12);
  rim.position.set(2.2, -1, -1.5);
  scene.add(rim);

  // start rotated so India faces the camera, matching the network overlay
  earth.rotation.y = -2.9;
  earth.rotation.x = 0.12;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let autoRotate = !reduceMotion;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let momentumX = 0;
  let resumeTimer = null;

  const dom = renderer.domElement;
  dom.style.touchAction = 'none';

  function pointFromEvent(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  }
  function onDown(e) {
    dragging = true;
    autoRotate = false;
    if (resumeTimer) clearTimeout(resumeTimer);
    const p = pointFromEvent(e);
    lastX = p.x; lastY = p.y;
    dom.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!dragging) return;
    const p = pointFromEvent(e);
    const dx = p.x - lastX, dy = p.y - lastY;
    earth.rotation.y += dx * 0.006;
    earth.rotation.x = Math.max(-1, Math.min(1, earth.rotation.x + dy * 0.006));
    atmosphere.rotation.y = earth.rotation.y;
    atmosphere.rotation.x = earth.rotation.x;
    momentumX = dx * 0.0007;
    lastX = p.x; lastY = p.y;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    dom.style.cursor = 'grab';
    if (!reduceMotion) resumeTimer = setTimeout(() => { autoRotate = true; }, 1500);
  }

  dom.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  dom.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onUp);

  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate) {
      earth.rotation.y += 0.0016;
    } else if (!dragging && Math.abs(momentumX) > 0.00005) {
      earth.rotation.y += momentumX;
      momentumX *= 0.94;
    }
    atmosphere.rotation.y = earth.rotation.y;
    atmosphere.rotation.x = earth.rotation.x;
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    width = mount.clientWidth;
    height = mount.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(mount);

  panel.classList.add('has-3d-earth');
}

function loadTexture(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}
