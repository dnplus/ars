import {
    Canvas,
    Fill,
    Shader,
    Skia,
    vec,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { useVideoConfig, useCurrentFrame } from "remotion";

const sksl = `
uniform float2 iResolution;
uniform float iTime;

float random(float2 p) {
    return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}

float rain(float2 uv) {
    uv.x -= mod(uv.x, 0.05);
    float offset = sin(uv.x * 15.0);
    float speed = cos(uv.x * 3.0) * 0.3 + 0.7;
    float y = fract(uv.y + iTime * speed + offset);
    return 1.0 / (y * 20.0);
}

vec4 main(vec2 pos) {
    vec2 uv = pos / iResolution;
    uv.y = 1.0 - uv.y; // Flip Y for shader coords
    
    float r = rain(uv);
    
    // Cyan/Blue color
    vec3 color = vec3(0.3, 0.7, 1.0) * r;
    
    // Fade out at bottom
    color *= smoothstep(0.0, 0.2, uv.y);
    
    return vec4(color, 1.0);
}
`;

export const SkiaMatrixRain: React.FC = () => {
    const { width, height, fps } = useVideoConfig(); // Remotion config
    const frame = useCurrentFrame(); // Remotion frame
    // removed useClockValue - use deterministic time instead

    // Compile shader
    const shader = useMemo(() => Skia.RuntimeEffect.Make(sksl), []);

    // Uniforms derived from Remotion frame (Move before conditional return)
    const uniforms = useMemo(() => {
        return {
            iResolution: vec(width, height),
            iTime: frame / fps, // Deterministic time in seconds
        };
    }, [width, height, frame, fps]);

    if (!shader) {
        return null;
    }

    return (
        <Canvas style={{ width, height }}>
            <Fill>
                <Shader source={shader} uniforms={uniforms} />
            </Fill>
        </Canvas>
    );
};
