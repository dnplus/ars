import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { ensureBrowser } from '@remotion/renderer';
import type { SeriesContext } from './context';

export type BrowserScreenshotPreset = 'normal' | 'square' | 'mobile';

function getViewportForPreset(preset: BrowserScreenshotPreset) {
  switch (preset) {
    case 'square':
      return { width: 900, height: 900, isMobile: false };
    case 'mobile':
      return { width: 430, height: 932, isMobile: true };
    case 'normal':
    default:
      return { width: 1280, height: 800, isMobile: false };
  }
}

const ENV_BROWSER_PATHS = [
  'PUPPETEER_EXECUTABLE_PATH',
  'CHROME_PATH',
  'GOOGLE_CHROME_BIN',
  'BROWSER_EXECUTABLE_PATH',
] as const;

const COMMON_BROWSER_PATHS = process.platform === 'darwin'
  ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  : process.platform === 'win32'
    ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
    : [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge',
    ];

async function resolveBrowserExecutable(): Promise<string | null> {
  for (const envName of ENV_BROWSER_PATHS) {
    const candidate = process.env[envName];
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const candidate of COMMON_BROWSER_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const browserStatus = await ensureBrowser({ logLevel: 'error' });
    if (browserStatus.type === 'user-defined-path' || browserStatus.type === 'local-puppeteer-browser') {
      return browserStatus.path;
    }
  } catch {
    // Fall through to null. Validation should report the screenshot failure instead of throwing.
  }

  return null;
}

async function captureWithLocalBrowser(
  url: string,
  outputPath: string,
  stepId: string,
  preset: BrowserScreenshotPreset,
): Promise<boolean> {
  const executablePath = await resolveBrowserExecutable();

  if (!executablePath) {
    return false;
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const viewport = getViewportForPreset(preset);
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    );
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 80, {
      timeout: 10_000,
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    if (/server not responding/i.test(bodyText)) {
      throw new Error('Captured fallback error page instead of the target page');
    }

    await page.screenshot({ path: outputPath, type: 'png' });
    await page.close();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Local browser screenshot failed for step "${stepId}": ${message}`);
    return false;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

async function captureWithMicrolink(
  url: string,
  outputPath: string,
  stepId: string,
  preset: BrowserScreenshotPreset,
): Promise<boolean> {
  try {
    const viewport = getViewportForPreset(preset);
    const params = new URLSearchParams({
      url,
      screenshot: 'true',
      meta: 'false',
      embed: 'screenshot.url',
      'viewport.width': String(viewport.width),
      'viewport.height': String(viewport.height),
      'viewport.isMobile': viewport.isMobile ? 'true' : 'false',
    });

    const imageResponse = await fetch(`https://api.microlink.io/?${params}`);
    if (!imageResponse.ok) {
      throw new Error(`Microlink screenshot returned ${imageResponse.status}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Microlink screenshot failed for step "${stepId}": ${message}`);
    return false;
  }
}

export async function captureUrlScreenshot(
  url: string,
  series: string,
  epId: string,
  stepId: string,
  ctx: SeriesContext,
  preset: BrowserScreenshotPreset = 'normal',
): Promise<string | null> {
  const relativePath = `episodes/${series}/${epId}/screenshots/${stepId}.png`;
  const outputPath = path.join(ctx.root, 'public', relativePath);

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const capturedWithMicrolink = await captureWithMicrolink(url, outputPath, stepId, preset);
    if (capturedWithMicrolink) {
      return relativePath;
    }

    const capturedLocally = await captureWithLocalBrowser(url, outputPath, stepId, preset);
    if (capturedLocally) {
      return relativePath;
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Browser screenshot failed for step "${stepId}": ${message}`);
    return null;
  }
}
