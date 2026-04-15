/**
 * @component ConnectedNodes
 * @description Animated 3D node graph with connecting lines.
 * Nodes appear sequentially with spring animation, connected by glowing lines.
 * Used for visualizing pipelines, flows, and evolution.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

type NodeData = {
  label: string;
  position: [number, number, number];
  color: string;
  /** Delay in seconds before this node appears */
  delay?: number;
  /** Whether this node is "broken" (shows red, X mark) */
  broken?: boolean;
};

type ConnectedNodesProps = {
  nodes: NodeData[];
  lineColor?: string;
};

const AnimatedNode: React.FC<{
  node: NodeData;
  index: number;
}> = ({ node, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const delay = node.delay ?? index * 0.5;

  const scale = interpolate(
    frame,
    [delay * fps, (delay + 0.4) * fps],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(
    frame,
    [delay * fps, (delay + 0.3) * fps],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Subtle floating
  const bob = Math.sin(time * 1.2 + index * 1.5) * 0.05;

  const color = useMemo(() => new THREE.Color(node.color), [node.color]);

  return (
    <group
      position={[
        node.position[0],
        node.position[1] + bob,
        node.position[2],
      ]}
      scale={scale}
    >
      {/* Node sphere */}
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>

      {/* Node glow */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Broken indicator */}
      {node.broken && scale > 0.5 && (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.5, 0.06, 0.06]} />
          <meshBasicMaterial color="#e03131" transparent opacity={opacity} />
        </mesh>
      )}
    </group>
  );
};

export const ConnectedNodes: React.FC<ConnectedNodesProps> = ({
  nodes,
  lineColor = '#c4a77d',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Draw connecting lines between sequential nodes
  const lines = useMemo(() => {
    const result: Array<{
      start: [number, number, number];
      end: [number, number, number];
      delay: number;
      broken: boolean;
    }> = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const startDelay = nodes[i].delay ?? i * 0.5;
      const endDelay = nodes[i + 1].delay ?? (i + 1) * 0.5;
      result.push({
        start: nodes[i].position,
        end: nodes[i + 1].position,
        delay: (startDelay + endDelay) / 2,
        broken: nodes[i + 1].broken ?? false,
      });
    }
    return result;
  }, [nodes]);

  return (
    <group>
      {/* Connecting lines */}
      {lines.map((line, i) => {
        const progress = interpolate(
          frame,
          [line.delay * fps, (line.delay + 0.3) * fps],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        if (progress <= 0) return null;

        const start = new THREE.Vector3(...line.start);
        const end = new THREE.Vector3(...line.end);
        const current = start.clone().lerp(end, progress);
        const mid = start.clone().lerp(current, 0.5);
        const length = start.distanceTo(current);

        const direction = current.clone().sub(start).normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        );

        return (
          <mesh
            key={`line-${i}`}
            position={[mid.x, mid.y, mid.z]}
            quaternion={quaternion}
          >
            <cylinderGeometry args={[0.015, 0.015, length, 4]} />
            <meshBasicMaterial
              color={line.broken ? '#e03131' : lineColor}
              transparent
              opacity={0.5 * progress}
            />
          </mesh>
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <AnimatedNode key={i} node={node} index={i} />
      ))}
    </group>
  );
};
