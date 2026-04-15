/**
 * @component ThreeSceneCard
 * @description Full-screen Three.js 3D scene card with animated text overlay.
 * Supports multiple scene presets (particles, orbit, nodes, orb)
 * with customizable colors and overlay text.
 *
 * @agent-note
 * **Use Case**: Dramatic visual moments — covers, transitions, key insights.
 * **Text Animation**: Headline uses per-word stagger reveal, bodyText uses blur-in.
 * Glass container animates scaleX from 0 to full width.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useTheme } from '../../shared/ThemeContext';
import { ParticleField } from '../three/ParticleField';
import { FloatingGeometry } from '../three/FloatingGeometry';
import { GlowOrb } from '../three/GlowOrb';
import { ConnectedNodes } from '../three/ConnectedNodes';

export type ThreeSceneType = 'particles' | 'orbit' | 'nodes' | 'orb';

type NodeConfig = {
  label: string;
  position: [number, number, number];
  color: string;
  delay?: number;
  broken?: boolean;
};

export type ThreeSceneCardProps = {
  sceneType: ThreeSceneType;
  /** Large headline overlay */
  headline?: string;
  /** Smaller body text below headline */
  bodyText?: string;
  /** Custom node data for 'nodes' scene type */
  nodes?: NodeConfig[];
  /** Override primary color */
  primaryColor?: string;
  /** Override secondary color */
  secondaryColor?: string;
  /** Show text with glassmorphism card, or bare overlay */
  textStyle?: 'glass' | 'bare' | 'none';
};

export const ThreeSceneCard: React.FC<ThreeSceneCardProps> = ({
  sceneType,
  headline,
  bodyText,
  nodes,
  primaryColor,
  secondaryColor,
  textStyle = 'glass',
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const color1 = primaryColor || theme.colors.primary;
  const color2 = secondaryColor || theme.colors.secondary;

  // Glass container scaleX animation (expand from center)
  const containerScaleX = interpolate(
    frame,
    [Math.floor(fps * 0.3), Math.floor(fps * 0.8)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Container slide + fade
  const containerOpacity = interpolate(
    frame,
    [Math.floor(fps * 0.3), Math.floor(fps * 0.6)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const containerSlide = interpolate(
    frame,
    [Math.floor(fps * 0.3), Math.floor(fps * 0.9)],
    [40, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Per-word headline animation
  const headlineWords = headline ? headline.split(/(\s+|\n)/) : [];
  const getWordStyle = (wordIndex: number, totalWords: number): React.CSSProperties => {
    const wordDelay = Math.floor(fps * 0.5) + wordIndex * Math.floor(fps * 0.06);
    const wordProgress = spring({
      frame: Math.max(0, frame - wordDelay),
      fps,
      config: { damping: 14, stiffness: 160, mass: 0.6 },
    });
    const wordOpacity = interpolate(wordProgress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const wordY = interpolate(wordProgress, [0, 1], [20, 0]);
    const wordScale = interpolate(wordProgress, [0, 1], [0.9, 1]);

    return {
      display: 'inline-block',
      opacity: wordOpacity,
      transform: `translateY(${wordY}px) scale(${wordScale})`,
    };
  };

  // Body text blur-in
  const bodyDelay = Math.floor(fps * 0.8) + headlineWords.length * Math.floor(fps * 0.04);
  const bodyProgress = interpolate(
    frame,
    [bodyDelay, bodyDelay + Math.floor(fps * 0.5)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );
  const bodyBlur = interpolate(bodyProgress, [0, 1], [8, 0]);
  const bodyOpacity = interpolate(bodyProgress, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Particles — always full-screen, not offset
  const renderParticles = () => {
    switch (sceneType) {
      case 'particles': return <ParticleField color={color1} secondaryColor={color2} speed={0.8} spread={18} />;
      case 'orbit': return <ParticleField color={color1} secondaryColor={color2} speed={0.5} spread={18} />;
      case 'nodes': return <ParticleField color={color1} secondaryColor={color2} speed={0.3} spread={22} />;
      case 'orb': return <ParticleField color={color1} secondaryColor={color2} speed={0.6} spread={18} />;
      default: return <ParticleField color={color1} secondaryColor={color2} spread={18} />;
    }
  };

  // Main objects — offset to bottom-right
  const renderMainObjects = () => {
    switch (sceneType) {
      case 'particles': return <FloatingGeometry color={color1} secondaryColor={color2} />;
      case 'orbit': return <GlowOrb color={color1} size={1.5} />;
      case 'nodes': return nodes ? <ConnectedNodes nodes={nodes} lineColor={color1} /> : null;
      case 'orb': return <GlowOrb color={color1} size={2} pulseSpeed={0.5} />;
      default: return null;
    }
  };

  const renderHeadlineWords = () =>
    headlineWords.map((word, i) => {
      if (word === '\n') return <br key={i} />;
      if (/^\s+$/.test(word)) return <span key={i}>{word}</span>;
      return (
        <span key={i} style={getWordStyle(i, headlineWords.length)}>
          {word}
        </span>
      );
    });

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1714' }}>
      {/* Three.js 3D Background */}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.5} color={color1} />
        {renderParticles()}
        <group position={[
          Math.cos(frame / fps * 0.15) * 3.5,
          Math.sin(frame / fps * 0.15) * 2,
          0,
        ]}>
          {renderMainObjects()}
        </group>
      </ThreeCanvas>

      {/* Gradient overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(26,23,20,0.5) 0%, rgba(26,23,20,0.25) 40%, transparent 70%)',
          zIndex: 1,
        }}
      />

      {/* Text Overlay */}
      {textStyle !== 'none' && (headline || bodyText) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2,
            opacity: containerOpacity,
            transform: `translateY(${containerSlide}px)`,
          }}
        >
          {textStyle === 'glass' ? (
            <div
              style={{
                background: 'rgba(45, 40, 35, 0.6)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: '40px 56px',
                border: `1px solid rgba(196, 167, 125, 0.2)`,
                maxWidth: '75%',
                textAlign: 'center',
                transformOrigin: 'center',
                transform: `scaleX(${containerScaleX})`,
              }}
            >
              {headline && (
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    color: theme.colors.primary,
                    lineHeight: 1.3,
                    marginBottom: bodyText ? 20 : 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {renderHeadlineWords()}
                </div>
              )}
              {bodyText && (
                <div
                  style={{
                    fontSize: 24,
                    color: theme.colors.onDark,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-line',
                    opacity: bodyOpacity,
                    filter: `blur(${bodyBlur}px)`,
                  }}
                >
                  {bodyText}
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: '80%', textAlign: 'center' }}>
              {headline && (
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: '#fff',
                    lineHeight: 1.2,
                    marginBottom: bodyText ? 24 : 0,
                    textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 30px rgba(0,0,0,0.7)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {renderHeadlineWords()}
                </div>
              )}
              {bodyText && (
                <div
                  style={{
                    fontSize: 28,
                    color: 'rgba(255,255,255,0.8)',
                    lineHeight: 1.5,
                    textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 4px 20px rgba(0,0,0,0.6)',
                    whiteSpace: 'pre-line',
                    opacity: bodyOpacity,
                    filter: `blur(${bodyBlur}px)`,
                  }}
                >
                  {bodyText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
