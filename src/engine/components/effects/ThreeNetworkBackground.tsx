import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '../../shared/ThemeContext';

const NodeParticles = () => {
    const theme = useTheme();
    const { fps } = useVideoConfig();
    const frame = useCurrentFrame();

    // Particle settings
    const particleCount = 200;
    const connectionRadius = 2.5;

    // Generate deterministic random positions (seeded by index)
    const originalPositions = useMemo(() => {
        const orig = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            // Use deterministic pseudo-random based on index
            const seed = (i * 9301 + 49297) % 233280;
            const r1 = seed / 233280;
            const seed2 = (seed * 9301 + 49297) % 233280;
            const r2 = seed2 / 233280;
            const seed3 = (seed2 * 9301 + 49297) % 233280;
            const r3 = seed3 / 233280;

            orig[i * 3] = (r1 - 0.5) * 20;
            orig[i * 3 + 1] = (r2 - 0.5) * 15;
            orig[i * 3 + 2] = (r3 - 0.5) * 10 - 5;
        }
        return orig;
    }, []);

    // Compute all geometry per frame (deterministic, no refs needed)
    const time = (frame / fps) * 0.5;
    const color = new THREE.Color(theme.colors.primary);

    // Compute animated particle positions
    const animatedPositions = useMemo(() => {
        const pos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            pos[i3] = originalPositions[i3] + Math.sin(time + originalPositions[i3 + 1]) * 1.5;
            pos[i3 + 1] = originalPositions[i3 + 1] + Math.cos(time * 0.8 + originalPositions[i3]) * 1.5;
            pos[i3 + 2] = originalPositions[i3 + 2] + Math.sin(time * 0.5 + i) * 2.0;
        }
        return pos;
    }, [time, originalPositions]);

    // Compute connecting lines
    const { linePositions, lineColors, vertexCount } = useMemo(() => {
        const maxLines = particleCount * 20;
        const lp = new Float32Array(maxLines * 6);
        const lc = new Float32Array(maxLines * 6);
        let vc = 0;

        for (let i = 0; i < particleCount; i++) {
            for (let j = i + 1; j < particleCount; j++) {
                const dx = animatedPositions[i * 3] - animatedPositions[j * 3];
                const dy = animatedPositions[i * 3 + 1] - animatedPositions[j * 3 + 1];
                const dz = animatedPositions[i * 3 + 2] - animatedPositions[j * 3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < connectionRadius * connectionRadius) {
                    const alpha = 1.0 - (Math.sqrt(distSq) / connectionRadius);

                    lp[vc * 3] = animatedPositions[i * 3];
                    lp[vc * 3 + 1] = animatedPositions[i * 3 + 1];
                    lp[vc * 3 + 2] = animatedPositions[i * 3 + 2];
                    lp[vc * 3 + 3] = animatedPositions[j * 3];
                    lp[vc * 3 + 4] = animatedPositions[j * 3 + 1];
                    lp[vc * 3 + 5] = animatedPositions[j * 3 + 2];

                    const r = color.r * alpha;
                    const g = color.g * alpha;
                    const b = color.b * alpha;
                    lc[vc * 3] = r;     lc[vc * 3 + 1] = g; lc[vc * 3 + 2] = b;
                    lc[vc * 3 + 3] = r;  lc[vc * 3 + 4] = g; lc[vc * 3 + 5] = b;

                    vc += 2;
                }
            }
        }
        return { linePositions: lp, lineColors: lc, vertexCount: vc };
    }, [animatedPositions, color]);

    // Build line geometry
    const lineGeometry = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
        geometry.setDrawRange(0, vertexCount);
        return geometry;
    }, [linePositions, lineColors, vertexCount]);

    return (
        <group>
            {/* Particles */}
            <points>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[animatedPositions, 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.08}
                    color={theme.colors.accent}
                    transparent
                    opacity={0.8}
                    sizeAttenuation
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* Connecting Lines */}
            <lineSegments geometry={lineGeometry}>
                <lineBasicMaterial
                    vertexColors
                    transparent
                    opacity={0.6}
                    blending={THREE.AdditiveBlending}
                />
            </lineSegments>
        </group>
    );
};

export const ThreeNetworkBackground: React.FC = () => {
    return (
        <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ alpha: true }} frameloop="demand">
            <ambientLight intensity={0.5} />
            <NodeParticles />
        </Canvas>
    );
};
