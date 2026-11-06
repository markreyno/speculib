import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Resource } from "./data";
import { clusterPosition, subjectHash } from "./space";
export default function Universe({
  books,
  exploring,
  onSelect,
}: {
  books: Resource[];
  exploring: boolean;
  onSelect: (r: Resource) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = el.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#040910", 0.00035);

    const place = (x: number, y: number, z: number) =>
      new THREE.Vector3(
        x * (exploring ? 1 : 1.1),
        exploring ? y : y * 0.48 + 195,
        z,
      );
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
    camera.position.set(0, 0, exploring ? 650 : 710);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = exploring;
    controls.enableDamping = true;
    controls.minDistance = 10;
    controls.maxDistance = 1200;
    controls.zoomSpeed = 1.5;
    const geo = new THREE.BufferGeometry();
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const pos = new Float32Array(1400 * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = (rand() - 0.5) * 1900;
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#9baeb9",
        size: 1.4,
        transparent: true,
        opacity: 0.6,
      }),
    );
    scene.add(stars);
    const sprites: THREE.Sprite[] = [];
    const disposables: THREE.Texture[] = [];
    const ambientGeometries: THREE.BufferGeometry[] = [];
    const ambientMaterials: THREE.Material[] = [];
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const gc = glowCanvas.getContext("2d")!;
    const glow = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.12, "#ffffff");
    glow.addColorStop(0.32, "#ffffff80");
    glow.addColorStop(1, "#ffffff00");
    gc.fillStyle = glow;
    gc.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    stars.material.map = glowTexture;
    stars.material.size = 2.4;
    stars.material.opacity = 0.58;
    stars.material.needsUpdate = true;
    disposables.push(glowTexture);
    const topics = Array.from(
      new Set(books.map((b) => b.subjects[0] || "Uncategorized")),
    );
    topics.forEach((topic) => {
      const center = clusterPosition(topic);
      const vertices: number[] = [];
      // Atmospheric dust gives the subject regions depth; only bright beacons are resources.
      for (let j = 0; j < 180; j++) {
        const a = rand() * Math.PI * 2;
        const radius = Math.sqrt(-2 * Math.log(Math.max(0.001, rand()))) * 37;
        const point = place(
          center.x + Math.cos(a) * radius * 1.5,
          center.y + Math.sin(a) * radius,
          center.z + (rand() - 0.5) * 110,
        );
        vertices.push(point.x, point.y, point.z);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      const material = new THREE.PointsMaterial({
        color: center.color,
        size: 4.5,
        map: glowTexture,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      ambientGeometries.push(geometry);
      ambientMaterials.push(material);
      scene.add(new THREE.Points(geometry, material));
      const haze = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: center.color,
          transparent: true,
          opacity: 0.045,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      haze.position.copy(place(center.x, center.y, center.z - 35));
      haze.scale.set(360, exploring ? 260 : 160, 1);
      scene.add(haze);
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 512;
      labelCanvas.height = 80;
      const lc = labelCanvas.getContext("2d")!;
      lc.font = "500 25px sans-serif";
      lc.fillStyle = center.color;
      lc.fillText(topic, 16, 43);
      lc.fillStyle = center.color + "66";
      lc.fillRect(16, 57, lc.measureText(topic).width, 1);
      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      disposables.push(labelTexture);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
        }),
      );
      label.scale.set(185, 29, 1);
      label.position.copy(place(center.x + 15, center.y + 72, center.z));
      scene.add(label);
    });
    books.forEach((b, i) => {
      const center = clusterPosition(b.subjects[0] || "Uncategorized");
      const hash = subjectHash(b.id);
      const a = (hash % 628) / 100;
      const radius = 15 + (hash % 45);
      const group = new THREE.Group();
      group.position.copy(
        place(
          center.x + Math.cos(a) * radius,
          center.y + Math.sin(a) * radius * 0.7,
          center.z + (hash % 50) - 25,
        ),
      );
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "#e9f7ef");
      grad.addColorStop(0.06, center.color);
      grad.addColorStop(0.2, center.color + "60");
      grad.addColorStop(1, center.color + "00");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      disposables.push(texture);
      const light = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      light.scale.set(22, 22, 1);
      group.add(light);
      if (exploring) {
        const c = document.createElement("canvas");
        c.width = 300;
        c.height = 430;
        const x = c.getContext("2d")!;
        x.fillStyle = b.color;
        x.fillRect(0, 0, 300, 430);
        x.fillStyle = "#161b1d";
        x.font = "14px Georgia";
        x.fillText("S P E C U L I B", 25, 40);
        x.font = "30px Georgia";
        let y = 115;
        let line = "";
        b.title.split(" ").forEach((w) => {
          if (x.measureText(line + w).width > 250) {
            x.fillText(line, 25, y);
            y += 37;
            line = "";
          }
          line += w + " ";
        });
        x.fillText(line, 25, y);
        x.font = "16px Georgia";
        x.fillText(b.author, 25, 385);
        const tex = new THREE.CanvasTexture(c);
        disposables.push(tex);
        if (b.cover)
          new THREE.TextureLoader().load(b.cover, (t) => {
            disposables.push(t);
            (cover.material as THREE.SpriteMaterial).map = t;
            (cover.material as THREE.SpriteMaterial).needsUpdate = true;
          });
        const cover = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 }),
        );
        cover.scale.set(40, 57, 1);
        cover.userData.book = b;
        group.add(cover);
        cover.userData.light = light;
        sprites.push(cover);
      }
      scene.add(group);
    });
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const click = (e: MouseEvent) => {
      if (!exploring) return;
      const box = host.getBoundingClientRect();
      pointer.set(
        ((e.clientX - box.left) / box.width) * 2 - 1,
        (-(e.clientY - box.top) / box.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray
        .intersectObjects(sprites)
        .find((h) => (h.object as THREE.Sprite).material.opacity > 0.2);
      if (hit) onSelect(hit.object.userData.book);
    };
    host.addEventListener("dblclick", click);
    const keys = new Set<string>();
    const down = (e: KeyboardEvent) => {
      if (
        exploring &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        keys.add(e.key.toLowerCase());
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const clearKeys = () => keys.clear();
    window.addEventListener("blur", clearKeys);
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      if (!exploring) renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const direction = new THREE.Vector3();
    const step = new THREE.Vector3();
    const side = new THREE.Vector3();
    const world = new THREE.Vector3();
    let frame = 0;
    const clock = new THREE.Clock();
    function animate() {
      if (document.hidden) return;
      if (!exploring) {
        renderer.render(scene, camera);
        return;
      }
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      if (exploring) {
        camera.getWorldDirection(direction);
        step
          .copy(direction)
          .multiplyScalar((keys.has("w") ? 2 : 0) - (keys.has("s") ? 2 : 0));
        side
          .crossVectors(direction, camera.up)
          .normalize()
          .multiplyScalar((keys.has("d") ? 2 : 0) - (keys.has("a") ? 2 : 0));
        step.add(side).multiplyScalar(delta * 60);
        camera.position.add(step);
        controls.target.add(step);
        sprites.forEach((s) => {
          const d = camera.position.distanceTo(s.getWorldPosition(world));
          s.material.opacity = THREE.MathUtils.clamp((430 - d) / 230, 0, 1);
          s.userData.light.material.opacity = 1 - s.material.opacity;
        });
      }
      controls.update();
      renderer.render(scene, camera);
    }
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        clock.start();
        animate();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    animate();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geo.dispose();
      ambientGeometries.forEach((g) => g.dispose());
      ambientMaterials.forEach((m) => m.dispose());
      (stars.material as THREE.Material).dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Sprite) o.material.dispose();
      });
      disposables.forEach((t) => t.dispose());
      renderer.dispose();
      host.removeChild(renderer.domElement);
      host.removeEventListener("dblclick", click);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clearKeys);
    };
  }, [books, exploring, onSelect]);
  return <div className={"universe " + (exploring ? "active" : "")} ref={el} />;
}
