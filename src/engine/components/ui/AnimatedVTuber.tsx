/**
 * @component AnimatedVTuber
 * @description VTuber avatar with audio-driven lip sync animation.
 *              Switches between mouth-open and mouth-closed images based on audio volume.
 *
 * @remotion-usage
 * - Place in StreamingOverlay or any scene
 * - Provide two images: mouthClosed (default) and mouthOpen (when talking)
 * - Audio source is automatically detected from current frame
 *
 * @example
 * ```tsx
 * <AnimatedVTuber
 *   mouthClosedSrc="vtuber/ginseng_closed.png"
 *   mouthOpenSrc="vtuber/ginseng_open.png"
 *   audioSrc="audio/step_0.mp3"
 *   volumeThreshold={0.15}
 * />
 * ```
 */
import React, { useEffect, useState } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { getAudioData } from "@remotion/media-utils";

type AudioDataType = Awaited<ReturnType<typeof getAudioData>>;

export type AnimatedVTuberProps = {
    /** Path to mouth-closed image (relative to public/) */
    mouthClosedSrc: string;
    /** Path to mouth-open image (relative to public/) */
    mouthOpenSrc: string;
    /** Audio source for lip sync (relative to public/). Optional — omit for static display */
    audioSrc?: string;
    /** Volume threshold to trigger mouth open (0-1, default: 0.15) */
    volumeThreshold?: number;
    /** Width of the VTuber image */
    width?: number;
    /** Height of the VTuber image */
    height?: number;
    /** Additional styles */
    style?: React.CSSProperties;
};

export const AnimatedVTuber: React.FC<AnimatedVTuberProps> = ({
    mouthClosedSrc,
    mouthOpenSrc,
    audioSrc,
    volumeThreshold = 0.02, // Lowered for TTS audio
    width = 300,
    height = 300,
    style,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const [audioData, setAudioData] = useState<AudioDataType | null>(null);
    const [audioError, setAudioError] = useState<boolean>(false);

    // Load audio data (skip if no audioSrc)
    useEffect(() => {
        if (!audioSrc) {
            setAudioData(null);
            return;
        }
        const loadAudio = async () => {
            try {
                setAudioError(false);
                const data = await getAudioData(staticFile(audioSrc));
                setAudioData(data);
            } catch (err) {
                console.error("Failed to load audio for lip sync:", err);
                setAudioError(true);
            }
        };
        loadAudio();
    }, [audioSrc]);

    // Calculate current volume
    const getCurrentVolume = (): number => {
        if (!audioData) return 0;

        const timeInSeconds = frame / fps;
        const sampleIndex = Math.floor(timeInSeconds * audioData.sampleRate);

        // Get a small window of samples around current position
        const windowSize = Math.floor(audioData.sampleRate * 0.03); // 30ms window (faster response)
        const startIndex = Math.max(0, sampleIndex - windowSize / 2);
        const endIndex = Math.min(audioData.channelWaveforms[0].length, sampleIndex + windowSize / 2);

        // Calculate RMS (Root Mean Square) volume
        let sumSquares = 0;
        let count = 0;

        for (let i = startIndex; i < endIndex; i++) {
            // Average all channels
            let sample = 0;
            for (const channel of audioData.channelWaveforms) {
                sample += Math.abs(channel[i] || 0);
            }
            sample /= audioData.channelWaveforms.length;
            sumSquares += sample * sample;
            count++;
        }

        const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;

        return rms;
    };

    const currentVolume = getCurrentVolume();
    const isTalking = !audioError && currentVolume > volumeThreshold;

    // Choose image based on volume (fallback to closed mouth on error)
    const currentSrc = isTalking ? mouthOpenSrc : mouthClosedSrc;

    // Breathing Animation
    const breathScale = interpolate(
        frame % (fps * 2),
        [0, fps, fps * 2],
        [1, 1.03, 1]
    );

    return (
        <div style={{
            transform: `scale(${breathScale})`,
            transformOrigin: "bottom center", // Anchor to bottom
            filter: "drop-shadow(6px 6px 12px rgba(0, 0, 0, 0.35))", // Add shadow here for depth
            ...style
        }}>
            <Img
                src={staticFile(currentSrc)}
                style={{
                    width,
                    height,
                    objectFit: "contain",
                }}
            />
        </div>
    );
};
