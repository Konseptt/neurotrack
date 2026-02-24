'use client';

import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RegionName } from '@/lib/store';
import { cn } from '@/lib/utils';

export interface RegionIntensity {
  region: RegionName;
  intensity: number; // 0 to 10
}

interface HeadDiagramProps {
  selectedRegions: RegionName[];
  onToggleRegion: (region: RegionName) => void;
  className?: string;
  /** Optional region intensities for heatmap coloring (0-10 per region) */
  regionIntensities?: RegionIntensity[];
  /** When true, shows nerve overlay paths on the 3D head */
  showNerveOverlay?: boolean;
}

const REGIONS: { name: RegionName; position: [number, number, number] }[] = [
  { name: 'Forehead', position: [0, 0.6, 0.8] },
  { name: 'Left temple', position: [0.6, 0.3, 0.4] },
  { name: 'Right temple', position: [-0.6, 0.3, 0.4] },
  { name: 'Behind left eye', position: [0.35, 0.15, 0.9] },
  { name: 'Behind right eye', position: [-0.35, 0.15, 0.9] },
  { name: 'Back of head', position: [0, 0.3, -0.9] },
  { name: 'Neck base', position: [0, -0.8, -0.2] },
];

const DUMMY_REGIONS: { name: string; position: [number, number, number] }[] = [
  { name: 'Nose', position: [0, -0.1, 1.0] },
  { name: 'Mouth', position: [0, -0.4, 0.9] },
  { name: 'Left cheek', position: [0.4, -0.3, 0.7] },
  { name: 'Right cheek', position: [-0.4, -0.3, 0.7] },
  { name: 'Left ear', position: [0.8, 0, 0] },
  { name: 'Right ear', position: [-0.8, 0, 0] },
  { name: 'Top of head', position: [0, 0.9, 0] },
  { name: 'Jaw', position: [0, -0.7, 0.5] },
  { name: 'Back of neck', position: [0, -0.6, -0.7] },
];

const ALL_VORONOI_REGIONS = [
  ...REGIONS.map(r => ({ ...r, clickable: true })),
  ...DUMMY_REGIONS.map(r => ({ ...r, clickable: false }))
];

/**
 * Trigeminal nerve pathway definitions - three main branches:
 * V1 (Ophthalmic), V2 (Maxillary), V3 (Mandibular)
 */
const NERVE_PATHS: { name: string; color: string; points: [number, number, number][] }[] = [
  {
    name: 'V1 Ophthalmic (Left)',
    color: '#60a5fa',
    points: [
      [0.3, -0.2, 0.3],
      [0.35, 0.0, 0.6],
      [0.35, 0.15, 0.85],
      [0.2, 0.4, 0.85],
      [0.0, 0.6, 0.8],
    ],
  },
  {
    name: 'V1 Ophthalmic (Right)',
    color: '#60a5fa',
    points: [
      [-0.3, -0.2, 0.3],
      [-0.35, 0.0, 0.6],
      [-0.35, 0.15, 0.85],
      [-0.2, 0.4, 0.85],
      [0.0, 0.6, 0.8],
    ],
  },
  {
    name: 'V2 Maxillary (Left)',
    color: '#34d399',
    points: [
      [0.3, -0.2, 0.3],
      [0.4, -0.1, 0.6],
      [0.4, -0.3, 0.7],
      [0.2, -0.1, 0.95],
    ],
  },
  {
    name: 'V2 Maxillary (Right)',
    color: '#34d399',
    points: [
      [-0.3, -0.2, 0.3],
      [-0.4, -0.1, 0.6],
      [-0.4, -0.3, 0.7],
      [-0.2, -0.1, 0.95],
    ],
  },
  {
    name: 'V3 Mandibular (Left)',
    color: '#f472b6',
    points: [
      [0.3, -0.2, 0.3],
      [0.5, -0.3, 0.4],
      [0.55, -0.5, 0.5],
      [0.3, -0.7, 0.5],
    ],
  },
  {
    name: 'V3 Mandibular (Right)',
    color: '#f472b6',
    points: [
      [-0.3, -0.2, 0.3],
      [-0.5, -0.3, 0.4],
      [-0.55, -0.5, 0.5],
      [-0.3, -0.7, 0.5],
    ],
  },
];

function NerveOverlay() {
  return (
    <group>
      {NERVE_PATHS.map((nerve) => {
        const curve = new THREE.CatmullRomCurve3(
          nerve.points.map((p) => new THREE.Vector3(...p))
        );
        const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.015, 8, false);
        return (
          <mesh key={nerve.name} geometry={tubeGeo}>
            <meshStandardMaterial
              color={nerve.color}
              transparent
              opacity={0.7}
              roughness={0.3}
              emissive={nerve.color}
              emissiveIntensity={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Converts an intensity (0-10) to a heatmap color (blue → green → yellow → red) */
function intensityToColor(intensity: number): THREE.Color {
  const t = Math.max(0, Math.min(1, intensity / 10));
  if (t < 0.25) {
    return new THREE.Color('#93c5fd').lerp(new THREE.Color('#6ee7b7'), t / 0.25);
  } else if (t < 0.5) {
    return new THREE.Color('#6ee7b7').lerp(new THREE.Color('#fde047'), (t - 0.25) / 0.25);
  } else if (t < 0.75) {
    return new THREE.Color('#fde047').lerp(new THREE.Color('#fb923c'), (t - 0.5) / 0.25);
  } else {
    return new THREE.Color('#fb923c').lerp(new THREE.Color('#ef4444'), (t - 0.75) / 0.25);
  }
}

class SimpleErrorBoundary extends React.Component<{children: React.ReactNode, fallback: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function RealisticHead({ onToggleRegion, selectedRegions, regionIntensities }: { onToggleRegion: (region: RegionName) => void, selectedRegions: RegionName[], regionIntensities?: RegionIntensity[] }) {
  const gltf = useGLTF('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb');

  // Extract PBR maps from the original model material
  const pbrMaps = useMemo(() => {
    let normalMap: THREE.Texture | null = null;
    let map: THREE.Texture | null = null;
    gltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.normalMap) normalMap = mat.normalMap;
        if (mat.map) map = mat.map;
      }
    });
    return { normalMap, map };
  }, [gltf]);
  
  const normalizedGeometry = useMemo(() => {
    let found: THREE.Mesh | null = null;
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !found) found = child as THREE.Mesh;
    });
    
    if (!found) return new THREE.SphereGeometry(1, 32, 32);
    
    const geo = (found as THREE.Mesh).geometry.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    const height = box.max.y - box.min.y;
    geo.scale(2 / height, 2 / height, 2 / height);
    geo.computeVertexNormals();
    return geo;
  }, [gltf]);

  const { vertexRegions, isBoundary } = useMemo(() => {
    const pos = normalizedGeometry.attributes.position;
    const vRegions = new Int32Array(pos.count);
    const boundary = new Uint8Array(pos.count);
    
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      let minDist = Infinity;
      let bestRegion = -1;
      ALL_VORONOI_REGIONS.forEach((r, rIdx) => {
        const dist = v.distanceTo(new THREE.Vector3(...r.position));
        if (dist < minDist) {
          minDist = dist;
          bestRegion = rIdx;
        }
      });
      vRegions[i] = bestRegion;
    }
    
    const index = normalizedGeometry.index;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i+1);
        const c = index.getX(i+2);
        const rA = vRegions[a];
        const rB = vRegions[b];
        const rC = vRegions[c];
        
        const isClickableA = ALL_VORONOI_REGIONS[rA].clickable;
        const isClickableB = ALL_VORONOI_REGIONS[rB].clickable;
        const isClickableC = ALL_VORONOI_REGIONS[rC].clickable;
        
        if ((rA !== rB || rB !== rC || rA !== rC) && (isClickableA || isClickableB || isClickableC)) {
          boundary[a] = 1;
          boundary[b] = 1;
          boundary[c] = 1;
        }
      }
    }
    
    return { vertexRegions: vRegions, isBoundary: boundary };
  }, [normalizedGeometry]);

  const [hoveredRegion, setHoveredRegion] = useState<RegionName | null>(null);

  const coloredGeometry = useMemo(() => {
    const geo = normalizedGeometry.clone();
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    
    const baseColor = new THREE.Color('#f3f4f6');
    const selectedColor = new THREE.Color('#fca5a5'); // red-300
    const hoveredColor = new THREE.Color('#fee2e2'); // red-100
    const selectedHoveredColor = new THREE.Color('#f87171'); // red-400
    const boundaryColor = new THREE.Color('#9ca3af'); // gray-400

    // Build intensity lookup map
    const intensityMap = new Map<RegionName, number>();
    if (regionIntensities) {
      regionIntensities.forEach(({ region, intensity }) => intensityMap.set(region, intensity));
    }
    
    for (let i = 0; i < pos.count; i++) {
      const rIdx = vertexRegions[i];
      const regionInfo = ALL_VORONOI_REGIONS[rIdx];
      
      let c = baseColor;
      
      if (regionInfo.clickable) {
        const regionName = regionInfo.name as RegionName;
        const isSelected = selectedRegions.includes(regionName);
        const isHovered = hoveredRegion === regionName;
        const regionIntensity = intensityMap.get(regionName);
        
        if (isBoundary[i]) {
          c = boundaryColor;
        } else if (regionIntensity !== undefined && regionIntensity > 0) {
          // Heatmap mode: intensity-based coloring
          c = intensityToColor(regionIntensity);
        } else if (isSelected && isHovered) {
          c = selectedHoveredColor;
        } else if (isSelected) {
          c = selectedColor;
        } else if (isHovered) {
          c = hoveredColor;
        }
      } else if (isBoundary[i]) {
        c = boundaryColor;
      }
      
      colors[i*3] = c.r;
      colors[i*3+1] = c.g;
      colors[i*3+2] = c.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [normalizedGeometry, vertexRegions, isBoundary, selectedRegions, hoveredRegion, regionIntensities]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.face) {
      const a = e.face.a;
      const rIdx = vertexRegions[a];
      const regionInfo = ALL_VORONOI_REGIONS[rIdx];
      if (regionInfo.clickable) {
        onToggleRegion(regionInfo.name as RegionName);
      }
    }
  };

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (e.face) {
      const a = e.face.a;
      const rIdx = vertexRegions[a];
      const regionInfo = ALL_VORONOI_REGIONS[rIdx];
      if (regionInfo.clickable) {
        const regionName = regionInfo.name as RegionName;
        if (hoveredRegion !== regionName) {
          setHoveredRegion(regionName);
          document.body.style.cursor = 'pointer';
        }
      } else {
        if (hoveredRegion !== null) {
          setHoveredRegion(null);
          document.body.style.cursor = 'auto';
        }
      }
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredRegion(null);
    document.body.style.cursor = 'auto';
  };

  return (
    <mesh 
      geometry={coloredGeometry}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors={true}
        roughness={0.55}
        metalness={0.05}
        normalMap={pbrMaps.normalMap ?? undefined}
        normalScale={new THREE.Vector2(0.8, 0.8)}
      />
    </mesh>
  );
}

// Preload the model
if (typeof window !== 'undefined') {
  useGLTF.preload('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb');
}

function FallbackHead({ onToggleRegion, selectedRegions }: { onToggleRegion: (region: RegionName) => void, selectedRegions: RegionName[] }) {
  const [hoveredPart, setHoveredPart] = useState<RegionName | null>(null);

  const handlePartClick = (e: any, region: RegionName) => {
    e.stopPropagation();
    onToggleRegion(region);
  };

  const getMaterialProps = (region: RegionName, defaultColor: string) => {
    const isSelected = selectedRegions.includes(region);
    const isHovered = hoveredPart === region;
    
    return {
      color: isSelected ? '#ef4444' : isHovered ? '#fca5a5' : defaultColor,
      emissive: isSelected ? '#ef4444' : '#000000',
      emissiveIntensity: isSelected ? 0.4 : 0,
    };
  };

  const getCraniumProps = () => {
    const isForeheadSelected = selectedRegions.includes('Forehead');
    const isBackSelected = selectedRegions.includes('Back of head');
    
    let color = '#fcd5ce';
    let emissive = '#000000';
    let emissiveIntensity = 0;

    if (isForeheadSelected && isBackSelected) {
      color = '#ef4444';
      emissive = '#ef4444';
      emissiveIntensity = 0.4;
    } else if (isForeheadSelected || isBackSelected) {
      color = '#f87171';
      emissive = '#ef4444';
      emissiveIntensity = 0.2;
    } else if (hoveredPart === 'Forehead' || hoveredPart === 'Back of head') {
      color = '#fca5a5';
    }

    return { color, emissive, emissiveIntensity };
  };

  const handlePointerOver = (e: any, region: RegionName) => {
    e.stopPropagation();
    setHoveredPart(region);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredPart(null);
    document.body.style.cursor = 'auto';
  };

  const handleCraniumPointerMove = (e: any) => {
    e.stopPropagation();
    const region = e.point.z > 0 ? 'Forehead' : 'Back of head';
    if (hoveredPart !== region) {
      setHoveredPart(region);
      document.body.style.cursor = 'pointer';
    }
  };

  return (
    <group>
      {/* Cranium / Skull (Back of head / Forehead) */}
      <mesh 
        position={[0, 0.2, 0]} 
        castShadow 
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.point.z > 0) {
            onToggleRegion('Forehead');
          } else {
            onToggleRegion('Back of head');
          }
        }}
        onPointerMove={handleCraniumPointerMove}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial {...getCraniumProps()} roughness={0.4} />
      </mesh>
      
      {/* Jaw / Lower Face */}
      <mesh position={[0, -0.3, 0.3]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.6, 0.8, 64]} />
        <meshStandardMaterial color="#fcd5ce" roughness={0.4} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0, 1.05]} castShadow receiveShadow>
        <coneGeometry args={[0.15, 0.4, 32]} />
        <meshStandardMaterial color="#fbc4ab" roughness={0.5} />
      </mesh>

      {/* Left Eye */}
      <mesh 
        position={[-0.35, 0.2, 0.9]} 
        castShadow 
        receiveShadow
        onClick={(e) => handlePartClick(e, 'Behind left eye')}
        onPointerOver={(e) => handlePointerOver(e, 'Behind left eye')}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.08, 32, 32]} />
        <meshStandardMaterial {...getMaterialProps('Behind left eye', '#1f2937')} roughness={0.2} />
      </mesh>

      {/* Right Eye */}
      <mesh 
        position={[0.35, 0.2, 0.9]} 
        castShadow 
        receiveShadow
        onClick={(e) => handlePartClick(e, 'Behind right eye')}
        onPointerOver={(e) => handlePointerOver(e, 'Behind right eye')}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.08, 32, 32]} />
        <meshStandardMaterial {...getMaterialProps('Behind right eye', '#1f2937')} roughness={0.2} />
      </mesh>

      {/* Left Ear (Temple area) */}
      <mesh 
        position={[-0.95, 0, 0.1]} 
        rotation={[0, 0, 0.2]} 
        castShadow 
        receiveShadow
        onClick={(e) => handlePartClick(e, 'Left temple')}
        onPointerOver={(e) => handlePointerOver(e, 'Left temple')}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.15, 0.15, 0.05, 32]} />
        <meshStandardMaterial {...getMaterialProps('Left temple', '#fcd5ce')} roughness={0.4} />
      </mesh>

      {/* Right Ear (Temple area) */}
      <mesh 
        position={[0.95, 0, 0.1]} 
        rotation={[0, 0, -0.2]} 
        castShadow 
        receiveShadow
        onClick={(e) => handlePartClick(e, 'Right temple')}
        onPointerOver={(e) => handlePointerOver(e, 'Right temple')}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.15, 0.15, 0.05, 32]} />
        <meshStandardMaterial {...getMaterialProps('Right temple', '#fcd5ce')} roughness={0.4} />
      </mesh>

      {/* Neck */}
      <mesh 
        position={[0, -1.0, -0.1]} 
        castShadow 
        receiveShadow
        onClick={(e) => handlePartClick(e, 'Neck base')}
        onPointerOver={(e) => handlePointerOver(e, 'Neck base')}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.45, 0.5, 1.0, 64]} />
        <meshStandardMaterial {...getMaterialProps('Neck base', '#fcd5ce')} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function HeadDiagram3D({ selectedRegions, onToggleRegion, className, regionIntensities, showNerveOverlay }: HeadDiagramProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-4 w-full", className)}>
      <div className="relative flex-1 aspect-square bg-gray-50 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing">
        <Canvas shadows camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={1} 
            castShadow 
            shadow-mapSize={1024}
          />
          <directionalLight 
            position={[-5, 5, -5]} 
            intensity={0.5} 
          />
          {/* Rim light for skin subsurface scattering approximation */}
          <directionalLight
            position={[0, 2, -4]}
            intensity={0.4}
            color="#fca5a5"
          />
          
          <Environment preset="city" />
          
          <group position={[0, 0.2, 0]}>
            <SimpleErrorBoundary fallback={<FallbackHead onToggleRegion={onToggleRegion} selectedRegions={selectedRegions} />}>
              <Suspense fallback={<FallbackHead onToggleRegion={onToggleRegion} selectedRegions={selectedRegions} />}>
                <RealisticHead onToggleRegion={onToggleRegion} selectedRegions={selectedRegions} regionIntensities={regionIntensities} />
                {showNerveOverlay && <NerveOverlay />}
              </Suspense>
            </SimpleErrorBoundary>
          </group>

          <ContactShadows 
            position={[0, -1.5, 0]} 
            opacity={0.4} 
            scale={5} 
            blur={2} 
            far={4} 
          />
          
          <OrbitControls 
            enablePan={false}
            minDistance={2}
            maxDistance={6}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Canvas>
        
        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <p className="text-xs text-gray-500 bg-white/80 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
            Drag to rotate • Scroll to zoom • Click parts to select
          </p>
        </div>
      </div>
      
      <div className="w-full md:w-48 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Regions</h3>
        {REGIONS.map((region) => (
          <button
            key={region.name}
            type="button"
            onClick={() => onToggleRegion(region.name)}
            className={cn(
              "text-left px-3 py-2 rounded-lg text-sm transition-colors",
              selectedRegions.includes(region.name)
                ? "bg-red-50 text-red-700 font-medium"
                : "hover:bg-gray-50 text-gray-600"
            )}
          >
            {region.name}
          </button>
        ))}
      </div>
    </div>
  );
}
