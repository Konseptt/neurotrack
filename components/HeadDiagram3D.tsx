'use client';

import React, { useState, useMemo, Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RegionName } from '@/lib/store';
import { cn } from '@/lib/utils';

interface HeadDiagramProps {
  selectedRegions: RegionName[];
  onToggleRegion: (region: RegionName) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// 15 anatomically-specific migraine regions.
// `facing` = the outward normal direction this region points toward — used
// for camera-dot-product visibility (region only shows when facing camera).
// LPS head: centred origin, height≈2, faces +Z, ears ±X, crown +Y.
// ---------------------------------------------------------------------------
const REGIONS: {
  name: RegionName;
  position: [number, number, number];
  facing: [number, number, number];   // normalised-ish outward direction
  color: string;
  description: string;
}[] = [
    {
      name: 'Frontal (Forehead)',
      position: [0, 0.70, 0.72],
      facing: [0, 0.25, 1],
      color: '#f97316',
      description: 'Above the brows, between the hairline',
    },
    {
      name: 'Vertex (Crown)',
      position: [0, 0.96, 0.10],
      facing: [0, 1, 0],
      color: '#eab308',
      description: 'Top of the skull',
    },
    {
      name: 'Left Temporal',
      position: [0.76, 0.28, 0.30],
      facing: [1, 0.1, 0.3],
      color: '#a855f7',
      description: 'Left temporal bone / temple area',
    },
    {
      name: 'Right Temporal',
      position: [-0.76, 0.28, 0.30],
      facing: [-1, 0.1, 0.3],
      color: '#8b5cf6',
      description: 'Right temporal bone / temple area',
    },
    {
      name: 'Left Parietal',
      position: [0.65, 0.60, -0.20],
      facing: [0.85, 0.5, -0.2],
      color: '#06b6d4',
      description: 'Left side of skull behind the temple',
    },
    {
      name: 'Right Parietal',
      position: [-0.65, 0.60, -0.20],
      facing: [-0.85, 0.5, -0.2],
      color: '#0ea5e9',
      description: 'Right side of skull behind the temple',
    },
    {
      name: 'Left Periorbital',
      position: [0.35, 0.12, 0.90],
      facing: [0.25, 0, 1],
      color: '#ef4444',
      description: 'Around / behind the left eye socket',
    },
    {
      name: 'Right Periorbital',
      position: [-0.35, 0.12, 0.90],
      facing: [-0.25, 0, 1],
      color: '#f43f5e',
      description: 'Around / behind the right eye socket',
    },
    {
      name: 'Left Sinus / Maxillary',
      position: [0.30, -0.15, 0.90],
      facing: [0.2, -0.15, 1],
      color: '#f59e0b',
      description: 'Left cheekbone / maxillary sinus area',
    },
    {
      name: 'Right Sinus / Maxillary',
      position: [-0.30, -0.15, 0.90],
      facing: [-0.2, -0.15, 1],
      color: '#d97706',
      description: 'Right cheekbone / maxillary sinus area',
    },
    {
      name: 'Left Auricular',
      position: [0.86, 0.02, 0.08],
      facing: [1, 0, 0.1],
      color: '#10b981',
      description: 'Around the left ear / mastoid region',
    },
    {
      name: 'Right Auricular',
      position: [-0.86, 0.02, 0.08],
      facing: [-1, 0, 0.1],
      color: '#059669',
      description: 'Around the right ear / mastoid region',
    },
    {
      name: 'Occipital (Back of Skull)',
      position: [0, 0.28, -0.92],
      facing: [0, 0.2, -1],
      color: '#3b82f6',
      description: 'Back of the skull / occipital bone',
    },
    {
      name: 'Suboccipital (Base of Skull)',
      position: [0, -0.38, -0.82],
      facing: [0, -0.35, -0.95],
      color: '#6366f1',
      description: 'Skull-neck junction / suboccipital muscles',
    },
    {
      name: 'Cervicogenic (Neck)',
      position: [0, -0.90, -0.10],
      facing: [0, -0.8, -0.25],
      color: '#22c55e',
      description: 'Upper cervical spine / neck base',
    },
  ];

// Pre-normalise facing vectors
const REGION_FACING = REGIONS.map(r => new THREE.Vector3(...r.facing).normalize());

// Dummy anchors to tighten Voronoi boundaries on non-pain zones
const DUMMY: [number, number, number][] = [
  [0, -0.12, 1.04],
  [0, -0.28, 1.00],
  [0, -0.48, 0.90],
  [0, -0.65, 0.72],
  [0, -0.78, 0.45],
  [0.42, -0.38, 0.74],
  [-0.42, -0.38, 0.74],
  [0.60, -0.10, 0.65],
  [-0.60, -0.10, 0.65],
  [0.92, 0.12, 0.22],
  [-0.92, 0.12, 0.22],
  [0.92, -0.10, 0.18],
  [-0.92, -0.10, 0.18],
  [0.55, -0.55, 0.35],
  [-0.55, -0.55, 0.35],
  [0.28, -0.55, -0.72],
  [-0.28, -0.55, -0.72],
  [0, 0.88, -0.55],
];

const ALL_ANCHORS = [
  ...REGIONS.map((r, i) => ({ pos: r.position, regionIdx: i, clickable: true })),
  ...DUMMY.map(pos => ({ pos, regionIdx: -1, clickable: false })),
];

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
class SimpleErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ---------------------------------------------------------------------------
// Build a sub-geometry containing only triangles from one Voronoi region
// ---------------------------------------------------------------------------
function buildRegionGeo(
  fullGeo: THREE.BufferGeometry,
  vertexAnchorMap: Int32Array,
  targetIdx: number
): THREE.BufferGeometry {
  const index = fullGeo.index!;
  const pos = fullGeo.attributes.position;
  const norm = fullGeo.attributes.normal;

  const posArr: number[] = [];
  const normArr: number[] = [];
  const idxArr: number[] = [];
  const remap = new Map<number, number>();

  const addVert = (vi: number) => {
    if (!remap.has(vi)) {
      const ni = posArr.length / 3;
      remap.set(vi, ni);
      posArr.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      normArr.push(norm.getX(vi), norm.getY(vi), norm.getZ(vi));
    }
    return remap.get(vi)!;
  };

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const score =
      +(vertexAnchorMap[a] === targetIdx) +
      +(vertexAnchorMap[b] === targetIdx) +
      +(vertexAnchorMap[c] === targetIdx);
    if (score >= 2) idxArr.push(addVert(a), addVert(b), addVert(c));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  geo.setIndex(idxArr);
  return geo;
}

// ---------------------------------------------------------------------------
// Realistic Head — camera-aware region overlays via useFrame
// ---------------------------------------------------------------------------
function RealisticHead({
  onToggleRegion,
  selectedRegions,
}: {
  onToggleRegion: (region: RegionName) => void;
  selectedRegions: RegionName[];
}) {
  const gltf = useGLTF(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb'
  );
  const { camera } = useThree();

  // Shared working vectors — allocated once, reused every frame
  const _camDir = useRef(new THREE.Vector3()).current;

  // ── Normalise geometry + skin material ─────────────────────────────────
  const { normalizedGeo, skinMaterial } = useMemo(() => {
    let found: THREE.Mesh | null = null;
    gltf.scene.traverse(c => { if ((c as THREE.Mesh).isMesh && !found) found = c as THREE.Mesh; });
    const mesh = (found as unknown) as THREE.Mesh;

    const geo = mesh.geometry.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    const s = 2 / (box.max.y - box.min.y);
    geo.scale(s, s, s);
    geo.computeVertexNormals();

    const cloneMat = (m: THREE.Material) => {
      const s = m.clone() as THREE.MeshStandardMaterial;
      s.roughness = 0.72; s.metalness = 0.0; s.needsUpdate = true;
      return s;
    };
    const mat = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMat)
      : cloneMat(mesh.material);

    return { normalizedGeo: geo, skinMaterial: mat };
  }, [gltf]);

  // ── Voronoi anchor map ──────────────────────────────────────────────────
  const vertexAnchorMap = useMemo(() => {
    const pos = normalizedGeo.attributes.position;
    const map = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      let minD2 = Infinity, best = 0;
      for (let a = 0; a < ALL_ANCHORS.length; a++) {
        const [ax, ay, az] = ALL_ANCHORS[a].pos;
        const d2 = (vx - ax) ** 2 + (vy - ay) ** 2 + (vz - az) ** 2;
        if (d2 < minD2) { minD2 = d2; best = a; }
      }
      map[i] = best;
    }
    return map;
  }, [normalizedGeo]);

  // ── Per-region sub-geometries ───────────────────────────────────────────
  const regionGeos = useMemo(() =>
    REGIONS.map((_, ri) => buildRegionGeo(normalizedGeo, vertexAnchorMap, ri)),
    [normalizedGeo, vertexAnchorMap]
  );

  // ── Refs to overlay materials for imperative opacity updates ────────────
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>(
    REGIONS.map(() => null)
  );

  // ── Refs to current selected / hovered state (avoids stale closures) ───
  const selectedRef = useRef(selectedRegions);
  selectedRef.current = selectedRegions;
  const hoveredRef = useRef(-1);

  // ── Frame loop: compute dot(cameraDir, regionFacing) each frame ─────────
  useFrame(() => {
    // Direction from head origin (world 0,0,0 + group offset ~0,0.12,0)
    // to camera — this is the "view direction" for each region
    _camDir.copy(camera.position).normalize();

    for (let ri = 0; ri < REGIONS.length; ri++) {
      const mat = matRefs.current[ri];
      if (!mat) continue;

      const dot = _camDir.dot(REGION_FACING[ri]);
      // Visibility gate: dot must be >0 (facing camera) to show
      // Smooth fade over 0..0.25 dot range (15° dead-band)
      const visibility = Math.max(0, Math.min(1, dot / 0.25));

      if (visibility === 0) {
        mat.visible = false;
        continue;
      }
      mat.visible = true;

      const isSelected = selectedRef.current.includes(REGIONS[ri].name);
      const isHovered = hoveredRef.current === ri;

      // Base opacity from selection/hover state
      const baseOpacity = isSelected
        ? (isHovered ? 0.75 : 0.60)
        : isHovered
          ? 0.40
          : 0.10;   // idle ghost — shows clickable zone

      mat.opacity = baseOpacity * visibility;
    }
  });

  // ── Hover state (via JS ref to avoid re-renders) ────────────────────────
  const [, forceHoverUpdate] = useState(0); // tiny re-render only for cursor

  const getRegionIdx = (face: any): number => {
    if (!face) return -1;
    const anchor = ALL_ANCHORS[vertexAnchorMap[face.a]];
    return anchor.clickable ? anchor.regionIdx : -1;
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    const ri = getRegionIdx(e.face);
    if (ri >= 0) onToggleRegion(REGIONS[ri].name);
  };

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const ri = getRegionIdx(e.face);
    if (ri !== hoveredRef.current) {
      hoveredRef.current = ri;
      document.body.style.cursor = ri >= 0 ? 'pointer' : 'auto';
      forceHoverUpdate(n => n + 1); // let useFrame pick up new opacity
    }
  };

  const handlePointerOut = () => {
    hoveredRef.current = -1;
    document.body.style.cursor = 'auto';
  };

  return (
    <group>
      {/* Realistic PBR skin — original LPS textures */}
      <mesh
        geometry={normalizedGeo}
        material={skinMaterial as any}
        castShadow receiveShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      />

      {/* Per-region overlay meshes — opacity driven by useFrame above */}
      {REGIONS.map((region, ri) => (
        <mesh key={region.name} geometry={regionGeos[ri]} renderOrder={1}>
          <meshBasicMaterial
            ref={(m) => { matRefs.current[ri] = m; }}
            color={region.color}
            transparent
            opacity={0.1}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  );
}

if (typeof window !== 'undefined') {
  useGLTF.preload('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb');
}

// ---------------------------------------------------------------------------
// Geometric fallback head (while loading / on error)
// ---------------------------------------------------------------------------
function FallbackHead({
  onToggleRegion,
  selectedRegions,
}: {
  onToggleRegion: (region: RegionName) => void;
  selectedRegions: RegionName[];
}) {
  const [hov, setHov] = useState<RegionName | null>(null);
  const mat = (r: RegionName, base: string) => {
    const sel = selectedRegions.includes(r);
    const h = hov === r;
    const c = REGIONS.find(x => x.name === r)?.color ?? '#ef4444';
    return { color: sel ? c : h ? `${c}99` : base, emissive: sel ? c : '#000', emissiveIntensity: sel ? 0.25 : 0 };
  };
  const over = (e: any, r: RegionName) => { e.stopPropagation(); setHov(r); document.body.style.cursor = 'pointer'; };
  const out = (e: any) => { e.stopPropagation(); setHov(null); document.body.style.cursor = 'auto'; };

  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow
        onClick={e => { e.stopPropagation(); onToggleRegion(e.point.z > 0 ? 'Frontal (Forehead)' : 'Occipital (Back of Skull)'); }}
        onPointerMove={e => { e.stopPropagation(); const r: RegionName = e.point.z > 0 ? 'Frontal (Forehead)' : 'Occipital (Back of Skull)'; if (hov !== r) { setHov(r); document.body.style.cursor = 'pointer'; } }}
        onPointerOut={out}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#f5c5ae" roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.35, 0.3]} castShadow>
        <cylinderGeometry args={[0.85, 0.60, 0.85, 64]} />
        <meshStandardMaterial color="#f5c5ae" roughness={0.65} />
      </mesh>
      {(['Left Periorbital', 'Right Periorbital'] as RegionName[]).map((r, i) => (
        <mesh key={r} position={[i === 0 ? 0.35 : -0.35, 0.22, 0.91]} castShadow
          onClick={e => { e.stopPropagation(); onToggleRegion(r); }}
          onPointerOver={e => over(e, r)} onPointerOut={out}>
          <sphereGeometry args={[0.09, 32, 32]} />
          <meshStandardMaterial {...mat(r, '#2d3748')} roughness={0.2} />
        </mesh>
      ))}
      {(['Left Temporal', 'Right Temporal'] as RegionName[]).map((r, i) => (
        <mesh key={r} position={[i === 0 ? 0.97 : -0.97, 0.06, 0.10]} rotation={[0, Math.PI / 2, 0]}
          onClick={e => { e.stopPropagation(); onToggleRegion(r); }}
          onPointerOver={e => over(e, r)} onPointerOut={out}>
          <cylinderGeometry args={[0.19, 0.19, 0.07, 32]} />
          <meshStandardMaterial {...mat(r, '#f5c5ae')} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, -1.02, -0.10]} castShadow
        onClick={e => { e.stopPropagation(); onToggleRegion('Cervicogenic (Neck)'); }}
        onPointerOver={e => over(e, 'Cervicogenic (Neck)')} onPointerOut={out}>
        <cylinderGeometry args={[0.46, 0.51, 1.0, 64]} />
        <meshStandardMaterial {...mat('Cervicogenic (Neck)', '#f5c5ae')} roughness={0.55} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------
export function HeadDiagram3D({ selectedRegions, onToggleRegion, className }: HeadDiagramProps) {
  const [tooltipInfo, setTooltipInfo] = useState<{ name: string; description: string } | null>(null);

  return (
    <div className={cn('flex flex-col md:flex-row gap-4 w-full', className)}>

      {/* 3-D viewport */}
      <div className="relative flex-1 aspect-square bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing">
        <Canvas
          shadows
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          camera={{ position: [0, 0.10, 3.9], fov: 42 }}
        >
          <ambientLight intensity={0.30} />
          <directionalLight
            position={[2.5, 3.5, 3.0]} intensity={2.4} color="#fff5e0" castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005}
          />
          <directionalLight position={[-2.5, 1.0, 1.5]} intensity={0.65} color="#cce0ff" />
          <directionalLight position={[0, 2.0, -3.5]} intensity={0.55} color="#ffe8cc" />
          <Environment preset="sunset" />

          <group position={[0, 0.12, 0]}>
            <SimpleErrorBoundary fallback={<FallbackHead onToggleRegion={onToggleRegion} selectedRegions={selectedRegions} />}>
              <Suspense fallback={<FallbackHead onToggleRegion={onToggleRegion} selectedRegions={selectedRegions} />}>
                <RealisticHead onToggleRegion={onToggleRegion} selectedRegions={selectedRegions} />
              </Suspense>
            </SimpleErrorBoundary>
          </group>

          <ContactShadows position={[0, -1.55, 0]} opacity={0.55} scale={5} blur={2.5} far={4} color="#00001a" />
          <OrbitControls enablePan={false} minDistance={2.2} maxDistance={6.0} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 1.4} />
        </Canvas>

        {/* Hover tooltip */}
        {tooltipInfo && (
          <div className="absolute top-3 left-3 right-3 pointer-events-none">
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-white text-sm font-semibold">{tooltipInfo.name}</p>
              <p className="text-white/60 text-xs">{tooltipInfo.description}</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <p className="text-xs text-white/50 bg-black/25 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
            Rotate to reveal regions · Click to select
          </p>
        </div>
      </div>

      {/* Region sidebar */}
      <div className="w-full md:w-56 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-1 overflow-y-auto max-h-[600px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-1 tracking-tight">Pain Regions</h3>
        <p className="text-xs text-gray-400 mb-3 leading-tight">
          Rotate 3D model to access all sides
        </p>
        {REGIONS.map(region => {
          const isSelected = selectedRegions.includes(region.name);
          return (
            <button
              key={region.name}
              type="button"
              onClick={() => onToggleRegion(region.name)}
              onMouseEnter={() => setTooltipInfo({ name: region.name, description: region.description })}
              onMouseLeave={() => setTooltipInfo(null)}
              title={region.description}
              className={cn(
                'text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2',
                isSelected ? 'font-semibold text-white shadow-sm' : 'hover:bg-gray-50 text-gray-600'
              )}
              style={isSelected ? { backgroundColor: region.color } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                style={{ backgroundColor: region.color }}
              />
              <span className="flex-1 leading-tight">{region.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
