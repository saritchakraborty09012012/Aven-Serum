import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 118);
  gradient.addColorStop(0, "rgba(30, 10, 12, 0.42)");
  gradient.addColorStop(0.45, "rgba(30, 10, 12, 0.2)");
  gradient.addColorStop(1, "rgba(30, 10, 12, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function upgradeMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const name = `${child.name} ${materials.map((material) => material?.name || "").join(" ")}`.toLowerCase();

    const rebuild = (material) => {
      if (!material) return material;
      let next = material;
      if (!next.isMeshPhysicalMaterial) {
        next = new THREE.MeshPhysicalMaterial({
          color: material.color ? material.color.clone() : new THREE.Color("#ffffff"),
          map: material.map || null,
          normalMap: material.normalMap || null,
          roughnessMap: material.roughnessMap || null,
          metalnessMap: material.metalnessMap || null,
          metalness: material.metalness ?? 0,
          roughness: material.roughness ?? 0.4,
          transparent: material.transparent,
          opacity: material.opacity,
          side: material.side,
        });
      }

      if (name.includes("glass") && !name.includes("pipette")) {
        next.transmission = 0.92;
        next.thickness = 0.18;
        next.ior = 1.44;
        next.roughness = 0.05;
        next.metalness = 0;
        next.color.set("#e2a263");
        next.attenuationColor.set("#c1742c");
        next.attenuationDistance = 2;
        next.envMapIntensity = 1.5;
        next.transparent = false;
        next.opacity = 1;
      } else if (name.includes("serum") || name.includes("liquid")) {
        next.transmission = 0;
        next.thickness = 0.2;
        next.ior = 1.35;
        next.roughness = 0.09;
        next.metalness = 0;
        next.color.set("#c97913");
        next.attenuationColor.set("#8a4308");
        next.attenuationDistance = 1.4;
        next.envMapIntensity = 1.1;
        next.clearcoat = 0.85;
        next.clearcoatRoughness = 0.06;
        next.emissive.set("#2a0f00");
        next.emissiveIntensity = 0.5;
        next.transparent = false;
        next.opacity = 1;
      } else if (name.includes("pipette")) {
        next.transmission = 0.45;
        next.thickness = 0.06;
        next.ior = 1.42;
        next.roughness = 0.16;
        next.color.set("#d6a06a");
        next.attenuationColor.set("#b1682d");
        next.attenuationDistance = 1.2;
        next.envMapIntensity = 0.9;
        next.transparent = true;
        next.opacity = 0.72;
      } else if (name.includes("bulb")) {
        next.color.set("#d3ac86");
        next.roughness = 0.58;
        next.metalness = 0;
        next.clearcoat = 0.05;
        next.clearcoatRoughness = 0.7;
        next.envMapIntensity = 0.35;
        next.transmission = 0;
        next.transparent = false;
        next.opacity = 1;
      } else if (name.includes("cap") || name.includes("collar")) {
        next.color.set("#d9b695");
        next.roughness = 0.52;
        next.metalness = 0;
        next.clearcoat = 0.22;
        next.clearcoatRoughness = 0.5;
        next.envMapIntensity = 0.45;
        next.transmission = 0;
      }

      next.envMapIntensity = next.envMapIntensity ?? 1;
      return next;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map(rebuild);
    } else {
      child.material = rebuild(child.material);
    }
  });
}

export default function BottleViewer({ open, onClose }) {
  const [started, setStarted] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState(false);
  const stageRef = useRef(null);
  const closeRef = useRef(null);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setStarted(true);
      window.lenis?.stop();
      document.body.classList.add("modal-open");
      const timer = window.setTimeout(() => closeRef.current?.focus(), 80);
      const onKey = (event) => {
        if (event.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("keydown", onKey);
        document.body.classList.remove("modal-open");
        window.lenis?.start();
      };
    }
    return undefined;
  }, [open, onClose]);

  useEffect(() => {
    if (!started) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;

    let disposed = false;
    let frame = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
    camera.position.set(0.1, 1.42, 5.5);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const key = new THREE.DirectionalLight(0xfff4e8, 2.25);
    key.position.set(3.2, 5.4, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0006;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xff771b, 1.9);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const fill = new THREE.PointLight(0xffd6ae, 6.5, 9, 2);
    fill.position.set(-2.2, 1.2, 2.4);
    scene.add(fill);

    scene.add(new THREE.HemisphereLight(0xfff8ef, 0x7a3008, 0.45));

    const group = new THREE.Group();
    scene.add(group);

    const plinthMaterial = new THREE.MeshPhysicalMaterial({
      color: "#e7c9aa",
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.65,
    });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.44, 0.18, 96), plinthMaterial);
    plinth.position.y = -0.095;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.32, 96),
      new THREE.MeshPhysicalMaterial({
        color: "#e8831b",
        roughness: 0.11,
        metalness: 0.02,
        transmission: 0.32,
        thickness: 0.2,
        ior: 1.35,
        transparent: true,
        opacity: 0.6,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.3,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.002;
    scene.add(pool);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.8),
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    scene.add(shadow);

    const particles = (() => {
      const count = 48;
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.1 + Math.random() * 1.7;
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = 0.2 + Math.random() * 2.6;
        positions[index * 3 + 2] = Math.sin(angle) * radius - 0.15;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: "#c83f0b",
        size: 0.019,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
      return points;
    })();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.14, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.8;
    controls.maxDistance = 7;
    controls.minPolarAngle = Math.PI * 0.24;
    controls.maxPolarAngle = Math.PI * 0.63;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.6;

    let interacting = false;
    let lastInteraction = performance.now();
    const onStart = () => {
      interacting = true;
    };
    const onEnd = () => {
      interacting = false;
      lastInteraction = performance.now();
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    const loader = new GLTFLoader();
    loader.load(
      "/models/ambar-bottle.glb",
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        upgradeMaterials(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const scale = 2.32 / Math.max(0.001, size.y);
        model.scale.setScalar(scale);
        const scaled = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        scaled.getCenter(center);
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= scaled.min.y;
        group.add(model);
        setModelReady(true);
      },
      undefined,
      () => {
        if (!disposed) setModelError(true);
      }
    );

    const setSize = () => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width / height < 0.85 ? 42 : 32;
      camera.updateProjectionMatrix();
    };
    setSize();
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(stage);

    const clock = new THREE.Clock();
    let autoRotate = 0.18;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      if (!openRef.current) return;
      if (!interacting && performance.now() - lastInteraction > 2200) {
        group.rotation.y += delta * autoRotate;
      }
      particles.rotation.y -= delta * 0.035;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            Object.values(material).forEach((value) => {
              if (value && value.isTexture) value.dispose();
            });
            material.dispose();
          });
        }
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === stage) stage.removeChild(renderer.domElement);
    };
  }, [started]);

  const handleAdd = useCallback(() => {
    onClose();
    window.setTimeout(() => {
      if (window.ascentaCheckout?.add) window.ascentaCheckout.add("serum");
      else document.querySelector("[data-co-add]")?.click();
    }, 80);
  }, [onClose]);

  return createPortal(
    <div className={`b3d ${open ? "on" : ""}`} role="dialog" aria-modal="true" aria-label="AVEN Serum in three dimensions" aria-hidden={!open}>
      <div className="b3d-scrim" onClick={onClose} />
      <div className="b3d-panel">
        <div className="b3d-stage" ref={stageRef} />
        <div className="b3d-copy">
          <p className="b3d-kicker">The bottle</p>
          <h3>
            AVEN <em>Serum</em>
          </h3>
          <p>Amber glass, a weighted dropper, and a silicone bulb that measures the morning.</p>
        </div>
        <div className="b3d-actions">
          <button type="button" className="btn solid" onClick={handleAdd}>
            Add to bag · $68
          </button>
        </div>
        <div className="b3d-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M8 11V6.8a1.8 1.8 0 0 1 3.6 0V11M11.6 10V5.6a1.8 1.8 0 0 1 3.6 0V11M15.2 10.4V7.2a1.8 1.8 0 0 1 3.6 0V14a6 6 0 0 1-6 6h-1.6a5 5 0 0 1-4-2l-3.2-4.3a1.7 1.7 0 0 1 2.6-2.2L8 13.2" />
          </svg>
          Drag to turn
        </div>
        <button type="button" className="b3d-close" ref={closeRef} onClick={onClose} aria-label="Close the 3D view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className={`b3d-loader ${modelReady && !modelError ? "gone" : ""}`}>
          {modelError ? (
            "The bottle is being poured"
          ) : (
            <>
              <span className="b3d-spinner" />
              {modelReady ? "Ready" : "Polishing the glass"}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
