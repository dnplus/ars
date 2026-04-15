/**
 * @component BackgroundMusic
 * @description Looping background music with volume control.
 *
 * @remotion-usage
 * - Plays BGM on loop throughout the video
 * - Volume set to 10% to not overpower narration
 * - Uses Remotion's Audio component with loop support
 *
 * @example
 * ```tsx
 * <BackgroundMusic src="bgm.mp3" volume={0.1} />
 * ```
 */
import React from "react";
import { Audio, staticFile } from "remotion";

export type BackgroundMusicProps = {
    /** Audio source (relative to public/) */
    src: string;
    /** Volume level (0-1), default 0.1 (10%) */
    volume?: number;
};

export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({
    src,
    volume = 0.1,
}) => {
    return (
        <Audio
            src={staticFile(src)}
            volume={volume}
            loop
        />
    );
};
