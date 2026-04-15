import { continueRender, delayRender, staticFile } from "remotion";

const FONT_FAMILY = "Noto Sans TC";
const HANDLE = delayRender(`Load local font: ${FONT_FAMILY}`);

let didStart = false;

const loadLocalFont = async () => {
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    continueRender(HANDLE);
    return;
  }

  const fonts = [
    { weight: "400", src: staticFile("shared/fonts/NotoSansTC-Regular.otf") },
    { weight: "500", src: staticFile("shared/fonts/NotoSansTC-Medium.otf") },
    { weight: "700", src: staticFile("shared/fonts/NotoSansTC-Bold.otf") },
  ];

  try {
    await Promise.all(
      fonts.map(async ({ weight, src }) => {
        const face = new FontFace(FONT_FAMILY, `url(${src}) format("opentype")`, {
          style: "normal",
          weight,
        });
        await face.load();
        document.fonts.add(face);
      })
    );
  } catch (error) {
    console.error(`Failed to load local font ${FONT_FAMILY}`, error);
  } finally {
    continueRender(HANDLE);
  }
};

if (!didStart) {
  didStart = true;
  void loadLocalFont();
}

export {};
