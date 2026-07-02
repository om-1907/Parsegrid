"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  A drifting grid of glowing "data nodes" — a nod to Parsegrid:      */
/*  a document parsed into a structured grid of fields.                */
/* ------------------------------------------------------------------ */

const COLS = 16;
const ROWS = 9;
const GAP = 0.62;
const COUNT = COLS * ROWS;

function NodeField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const brand = useMemo(() => new THREE.Color("#6366f1"), []);
  const accent = useMemo(() => new THREE.Color("#22d3ee"), []);

  const nodes = useMemo(() => {
    const arr: { x: number; y: number; seed: number }[] = [];
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        arr.push({
          x: (i - (COLS - 1) / 2) * GAP,
          y: (j - (ROWS - 1) / 2) * GAP,
          seed: i * 0.7 + j * 1.3,
        });
      }
    }
    return arr;
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    for (let idx = 0; idx < nodes.length; idx++) {
      const n = nodes[idx];
      const wave = Math.sin(t * 0.9 + n.x * 0.55 + n.y * 0.4);
      const z = wave * 0.7;
      dummy.position.set(n.x, n.y, z);
      const pulse = (Math.sin(t * 1.4 + n.seed) * 0.5 + 0.5);
      const s = 0.09 + pulse * 0.07;
      dummy.scale.setScalar(s);
      dummy.rotation.set(t * 0.25 + n.seed, t * 0.18 + n.x, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);

      color.copy(brand).lerp(accent, pulse * 0.6);
      mesh.setColorAt(idx, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        metalness={0.35}
        roughness={0.25}
        emissive="#4f46e5"
        emissiveIntensity={0.55}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function Backdrop() {
  const ref = useRef<THREE.LineSegments>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
      ref.current.rotation.x = state.clock.elapsedTime * 0.02;
    }
  });
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(6.5, 1);
    return new THREE.EdgesGeometry(geo);
  }, []);
  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#312e81" transparent opacity={0.35} toneMapped={false} />
    </lineSegments>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    target.current.x = (e.pointer.y ?? 0) * 0.18;
    target.current.y = (e.pointer.x ?? 0) * 0.28;
  };

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.x += (target.current.x - group.current.rotation.x) * 0.05;
    group.current.rotation.y += (target.current.y - group.current.rotation.y) * 0.05;
  });

  return (
    <>
      <color attach="background" args={["#070914"]} />
      <fog attach="fog" args={["#070914", 9, 20]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 6, 8]} intensity={120} color="#818cf8" />
      <pointLight position={[-8, -4, 4]} intensity={90} color="#22d3ee" />
      {/* invisible plane to capture pointer across the whole canvas */}
      <mesh position={[0, 0, -2]} onPointerMove={onPointerMove}>
        <planeGeometry args={[40, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={group}>
        <Backdrop />
        <NodeField />
      </group>
    </>
  );
}

export default function HeroCanvas() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Only enable WebGL when supported and motion is allowed.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let supported = false;
    try {
      const canvas = document.createElement("canvas");
      supported = !!(
        canvas.getContext("webgl2") || canvas.getContext("webgl")
      );
    } catch {
      supported = false;
    }
    setEnabled(supported && !reduced);
  }, []);

  // Pause the render loop when the hero scrolls out of view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 h-full w-full" aria-hidden>
      {/* CSS fallback / base layer — always present so there's never a blank hero */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1e1b4b_0%,#070914_55%,#050510_100%)]" />
      <div className="absolute inset-0 bg-grid opacity-[0.15]" />
      {enabled && (
        <Canvas
          className="!absolute inset-0"
          frameloop={active ? "always" : "never"}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 9], fov: 50 }}
        >
          <Scene />
        </Canvas>
      )}
      {/* Vignette + fade to page so the hero blends into the section below */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#070914_95%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
