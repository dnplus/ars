/**
 * @component GlowOrb (DataCore)
 * @description Central AI data core — icosahedron wireframe with orbiting
 * data rings and radiating signal lines. Agentic AI themed aesthetic.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig, interpolate, random } from 'remotion';

type GlowOrbProps = {
  color?: string;
  pulseSpeed?: number;
  size?: number;
};

const SIGNAL_COUNT = 6;

export const GlowOrb: React.FC<GlowOrbProps> = ({
  color = '#c4a77d',
  pulseSpeed = 1,
  size = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  // Entry animation
  const entryScale = interpolate(frame, [0, fps * 0.8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Pulse animation
  const pulse = 1 + Math.sin(time * 2 * pulseSpeed) * 0.06;
  const currentScale = size * entryScale * pulse;

  const coreColor = useMemo(() => new THREE.Color(color), [color]);
  const glowColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.4), [color]);
  const signalColor = useMemo(() => new THREE.Color(color).multiplyScalar(1.5), [color]);

  // Data ring rotation
  const ring1Rot = time * 0.4;
  const ring2Rot = time * 0.3;
  const ring3Rot = time * 0.5;

  // Signal lines — small spheres radiating outward from core
  const signals = useMemo(() => {
    return Array.from({ length: SIGNAL_COUNT }, (_, i) => ({
      angle: (i / SIGNAL_COUNT) * Math.PI * 2,
      tilt: (random(`sig-tilt-${i}`) - 0.5) * 0.8,
      speed: 0.8 + random(`sig-speed-${i}`) * 0.6,
      offset: random(`sig-offset-${i}`) * 3,
    }));
  }, []);

  return (
    <group scale={currentScale}>
      {/* Core — wireframe icosahedron (techy, not organic) */}
      <mesh rotation={[time * 0.1, time * 0.15, 0]}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshBasicMaterial color={coreColor} wireframe transparent opacity={0.7} />
      </mesh>

      {/* Inner solid core (subtle fill) */}
      <mesh rotation={[time * 0.1, time * 0.15, 0]}>
        <icosahedronGeometry args={[0.35, 1]} />
        <meshBasicMaterial color={coreColor} transparent opacity={0.3} />
      </mesh>

      {/* Outer glow shell */}
      <mesh>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.12 + Math.sin(time * 3) * 0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Data ring 1 — horizontal */}
      <mesh rotation={[Math.PI / 2, ring1Rot, 0]}>
        <torusGeometry args={[1.0, 0.012, 6, 48]} />
        <meshBasicMaterial color={coreColor} transparent opacity={0.5} />
      </mesh>

      {/* Data ring 2 — tilted */}
      <mesh rotation={[Math.PI / 3, -ring2Rot, Math.PI / 6]}>
        <torusGeometry args={[1.2, 0.008, 6, 48]} />
        <meshBasicMaterial color={coreColor} transparent opacity={0.3} />
      </mesh>

      {/* Data ring 3 — perpendicular */}
      <mesh rotation={[0, ring3Rot, Math.PI / 4]}>
        <torusGeometry args={[0.85, 0.01, 6, 48]} />
        <meshBasicMaterial color={coreColor} transparent opacity={0.35} />
      </mesh>

      {/* Signal pulses — small dots radiating outward along axes */}
      {signals.map((sig, i) => {
        const cycleTime = 2.0 / sig.speed;
        const t = ((time + sig.offset) % cycleTime) / cycleTime;
        const dist = 0.6 + t * 1.8; // radiate from core outward
        const opacity = Math.sin(t * Math.PI) * 0.8;

        const x = Math.cos(sig.angle) * dist * Math.cos(sig.tilt);
        const y = Math.sin(sig.tilt) * dist;
        const z = Math.sin(sig.angle) * dist * Math.cos(sig.tilt);

        return (
          <mesh key={`signal-${i}`} position={[x, y, z]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshBasicMaterial color={signalColor} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
};
