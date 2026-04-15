/**
 * @module index
 * @description 應用程式入口點 - 負責初始化 Remotion 與 Skia 環境
 */
import { LoadSkia } from "@shopify/react-native-skia/src/web";
import { registerRoot } from "remotion";

(async () => {
    await LoadSkia();
    const { RemotionRoot } = await import("./Root");
    registerRoot(RemotionRoot);
})();
