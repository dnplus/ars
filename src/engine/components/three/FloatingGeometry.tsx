/**
 * @component FloatingGeometry (NeuralMesh)
 * @description Floating neural network mesh — interconnected nodes with
 * signal pulses traveling along edges. AI/Agentic themed aesthetic.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig, interpolate, random } from 'remotion';

type NodeDef = {
  pos: [number, number, number];
  delay: number;
};

type EdgeDef = {
  from: number;
  to: number;
};

type FloatingGeometryProps = {
  color?: string;
  secondaryColor?: string;
};

const NODE_COUNT = 10;
const NODE_RADIUS = 0.12;
const EDGE_RADIUS = 0.015;
const PULSE_RADIUS = 0.06;

export const FloatingGeometry: React.FC<FloatingGeometryProps> = ({
  color = '#c4a77d',
  secondaryColor = '#8b7355',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const nodeColor = useMemo(() => new THREE.Color(color), [color]);
  const edgeColor = useMemo(() => new THREE.Color(secondaryColor), [secondaryColor]);
  const pulseColor = useMemo(() => new THREE.Color(color).multiplyScalar(1.5), [color]);

  // Generate nodes at semi-random positions
  const nodes: NodeDef[] = useMemo(() => {
    const result: NodeDef[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      result.push({
        pos: [
          (random(`nx-${i}`) - 0.5) * 7,
          (random(`ny-${i}`) - 0.5) * 5,
          (random(`nz-${i}`) - 0.5) * 4 - 2,
        ],
        delay: i * 0.15,
      });
    }
    return result;
  }, []);

  // Connect nearby nodes (distance < threshold)
  const edges: EdgeDef[] = useMemo(() => {
    const result: EdgeDef[] = [];
    const threshold = 4.0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].pos[0] - nodes[j].pos[0];
        const dy = nodes[i].pos[1] - nodes[j].pos[1];
        const dz = nodes[i].pos[2] - nodes[j].pos[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < threshold) {
          result.push({ from: i, to: j });
        }
      }
    }
    return result;
  }, [nodes]);

  return (
    <group>
      {/* Nodes — small glowing spheres */}
      {nodes.map((node, i) => {
        const entryProgress = interpolate(
          frame,
          [node.delay * fps, (node.delay + 0.5) * fps],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        // Subtle float
        const bobY = Math.sin(time * 0.6 + i * 1.2) * 0.15;
        const bobX = Math.cos(time * 0.4 + i * 0.8) * 0.1;

        return (
          <mesh
            key={`node-${i}`}
            position={[node.pos[0] + bobX, node.pos[1] + bobY, node.pos[2]]}
            scale={entryProgress}
          >
            <sphereGeometry args={[NODE_RADIUS, 12, 12]} />
            <meshBasicMaterial color={nodeColor} transparent opacity={0.9} />
          </mesh>
        );
      })}

      {/* Edges — thin lines connecting nodes */}
      {edges.map((edge, i) => {
        const a = nodes[edge.from];
        const b = nodes[edge.to];
        const startDelay = Math.max(a.delay, b.delay);
        const edgeProgress = interpolate(
          frame,
          [(startDelay + 0.3) * fps, (startDelay + 0.8) * fps],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        // Compute midpoint and direction for the cylinder
        const ax = a.pos[0], ay = a.pos[1], az = a.pos[2];
        const bx = b.pos[0], by = b.pos[1], bz = b.pos[2];
        const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Direction vector for rotation
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        const euler = new THREE.Euler().setFromQuaternion(quat);

        return (
          <mesh
            key={`edge-${i}`}
            position={[mx, my, mz]}
            rotation={euler}
            scale={[1, edgeProgress, 1]}
          >
            <cylinderGeometry args={[EDGE_RADIUS, EDGE_RADIUS, length, 4]} />
            <meshBasicMaterial color={edgeColor} transparent opacity={0.3 * edgeProgress} />
          </mesh>
        );
      })}

      {/* Signal pulses — small bright spheres traveling along edges */}
      {edges.map((edge, i) => {
        const a = nodes[edge.from].pos;
        const b = nodes[edge.to].pos;
        // Each pulse has its own cycle offset
        const cycleTime = 2.5 + random(`pulse-speed-${i}`) * 1.5;
        const offset = random(`pulse-offset-${i}`) * cycleTime;
        const t = ((time + offset) % cycleTime) / cycleTime;

        // Only show after edges appear
        const startDelay = Math.max(nodes[edge.from].delay, nodes[edge.to].delay) + 0.8;
        if (frame < startDelay * fps) return null;

        const px = a[0] + (b[0] - a[0]) * t;
        const py = a[1] + (b[1] - a[1]) * t;
        const pz = a[2] + (b[2] - a[2]) * t;
        // Pulse fades at edges of travel
        const pulseOpacity = Math.sin(t * Math.PI) * 0.9;

        return (
          <mesh key={`pulse-${i}`} position={[px, py, pz]}>
            <sphereGeometry args={[PULSE_RADIUS, 8, 8]} />
            <meshBasicMaterial color={pulseColor} transparent opacity={pulseOpacity} />
          </mesh>
        );
      })}
    </group>
  );
};
