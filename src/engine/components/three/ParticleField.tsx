/**
 * @component ParticleField
 * @description 3D animated particle cloud with floating points of light.
 * Creates a cosmic/ethereal atmosphere with thousands of tiny glowing particles
 * that slowly drift and pulse. Frame-driven for deterministic Remotion rendering.
 */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig, random } from 'remotion';

const PARTICLE_COUNT = 800;

type ParticleFieldProps = {
  color?: string;
  secondaryColor?: string;
  speed?: number;
  spread?: number;
};

export const ParticleField: React.FC<ParticleFieldProps> = ({
  color = '#c4a77d',
  secondaryColor = '#6b5d4d',
  speed = 1,
  spread = 12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groupRef = useRef<THREE.Group>(null);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);

    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(secondaryColor);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (random(`px-${i}`) - 0.5) * spread;
      pos[i * 3 + 1] = (random(`py-${i}`) - 0.5) * spread;
      pos[i * 3 + 2] = (random(`pz-${i}`) - 0.5) * spread;

      const t = random(`color-${i}`);
      const mixed = c1.clone().lerp(c2, t);
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }
    return { positions: pos, colors: col };
  }, [color, secondaryColor, spread]);

  // Frame-based animation
  const time = (frame / fps) * speed;

  // Update positions based on time
  const animatedPositions = useMemo(() => {
    const pos = new Float32Array(positions);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      const seed = i * 0.1;
      pos[idx] += Math.sin(time * 0.3 + seed) * 0.15;
      pos[idx + 1] += Math.cos(time * 0.2 + seed * 1.3) * 0.15;
      pos[idx + 2] += Math.sin(time * 0.25 + seed * 0.7) * 0.1;
    }
    return pos;
  }, [positions, time]);

  return (
    <group ref={groupRef} rotation={[0, time * 0.05, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[animatedPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
