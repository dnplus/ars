/**
 * @component SlideApp
 * @description 網頁簡報主應用 - 完整重用 Remotion 元件
 *              畫面與影片完全一致，只是可以互動操作換頁
 */
import React, { useMemo, useRef, useState, useCallback, useEffect, CSSProperties } from 'react';
import { Episode } from '../shared/types';
import { useSlideNavigation } from './hooks/useSlideNavigation';
import { episodeToSlides, getEpisodeInfo } from './adapters/episodeToSlides';
import { exportToPptx } from './utils/exportToPptx';
import { exportToPdf } from './utils/exportToPdf';
// 直接重用原本的 Layout 和 Scene
import { StreamingLayout } from '../layouts/StreamingLayout';
import { WebinarScene } from '../scenes/WebinarScene';
import { ThemeProvider } from '../shared/ThemeContext';
import { ActionBar } from './components/ActionBar';

import './styles/slides.css';

type SlideAppProps = {
  episode: Episode;
};

export const SlideApp: React.FC<SlideAppProps> = ({ episode }) => {
  const slides = useMemo(() => episodeToSlides(episode), [episode]);
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const querySeries = queryParams.get('series')?.trim() || undefined;
  const queryEpId = queryParams.get('ep')?.trim() || undefined;
  const queryStepId = queryParams.get('step')?.trim() || undefined;
  const fallbackSeries = querySeries ?? episode.metadata.series ?? 'unknown-series';
  const fallbackEpId = queryEpId ?? episode.metadata.id ?? 'unknown-episode';
  const initialStepIndex = useMemo(
    () => (queryStepId ? slides.findIndex((slide) => slide.step.id === queryStepId) : -1),
    [queryStepId, slides],
  );
  const episodeInfo = useMemo(() => {
    const info = getEpisodeInfo(episode);
    return {
      ...info,
      id: info.id ?? fallbackEpId,
      title: info.title || fallbackEpId,
      subtitle: info.subtitle ?? `${fallbackSeries}/${fallbackEpId}`,
      channelName: info.channelName ?? fallbackSeries,
      decorationText: info.decorationText ?? fallbackSeries,
      episodeTag: info.episodeTag ?? `${fallbackSeries}/${fallbackEpId}`,
    };
  }, [episode, fallbackEpId, fallbackSeries]);
  const appRef = useRef<HTMLDivElement>(null);
  const theme = episode.shell!.theme!;

  // Generate CSS variables from theme
  const themeStyles = useMemo(() => {
    return {
      '--color-primary': theme.colors.primary,
      '--color-bg-dark': theme.colors.surfaceDark,
      '--color-text-inverse': theme.colors.onPrimary,
      '--color-text-muted': theme.colors.onCardMuted,
      '--color-border': theme.colors.border,
      '--color-card-bg': theme.colors.surfaceCard,
      '--color-card-header-bg': theme.colors.surfaceCardHeader,
      '--font-main': theme.fonts.main,
      '--font-code': theme.fonts.code,
    } as CSSProperties;
  }, [theme]);

  // Handle fullscreen on this specific element
  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await appRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  }, []);

  // Audio control
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Audio play failed:', err);
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const {
    currentIndex,
    totalSlides,
    isFullscreen,
    showNotes,
    showOverview,
    next,
    prev,
    goTo,
    toggleNotes,
    toggleOverview,
  } = useSlideNavigation({
    totalSlides: slides.length,
    initialIndex: initialStepIndex >= 0 ? initialStepIndex : 0,
    onToggleFullscreen: handleToggleFullscreen,
    onToggleAudio: toggleAudio,
  });

  // Auto-scroll to current slide in overview
  const overviewRef = useRef<HTMLDivElement>(null);
  const didApplyStepQueryRef = useRef(false);
  useEffect(() => {
    if (showOverview && overviewRef.current) {
      const activeCard = overviewRef.current.querySelector('.overview-card.active');
      activeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showOverview]);

  useEffect(() => {
    if (!didApplyStepQueryRef.current && initialStepIndex >= 0 && currentIndex !== initialStepIndex) {
      didApplyStepQueryRef.current = true;
      goTo(initialStepIndex);
      return;
    }

    if (initialStepIndex >= 0) {
      didApplyStepQueryRef.current = true;
    }
  }, [currentIndex, goTo, initialStepIndex]);

  // Export handlers - defined after goTo is available
  const handleExport = useCallback(async (format: 'pptx' | 'pdf') => {
    setShowExportMenu(false);
    setIsExporting(true);
    
    try {
      if (format === 'pdf') {
        // 用 querySelector 作為備用
        const container = slideContainerRef.current || 
          document.querySelector('.slide-content-wrapper') as HTMLElement;
        if (!container) {
          throw new Error('Slide container not found');
        }
        await exportToPdf({
          slideContainer: container,
          goToSlide: goTo,
          currentIndex,
          totalSlides,
          filename: `${episode.metadata.id}_slides.pdf`,
        });
      } else {
        await exportToPptx(episode);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('匯出失敗，請查看 console');
    } finally {
      setIsExporting(false);
    }
  }, [episode, goTo, currentIndex, totalSlides]);

  const currentSlide = slides[currentIndex];

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Stop audio when changing slides
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [currentIndex]);

  // Calculate and apply scale to fit viewport
  useEffect(() => {
    const updateScale = () => {
      const viewport = appRef.current?.querySelector('.slide-viewport') as HTMLElement;
      const wrapper = slideContainerRef.current;
      if (!viewport || !wrapper) return;
      
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const scale = Math.min(vw / 1920, vh / 1080);
      
      wrapper.style.transform = `scale(${scale})`;
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  if (!currentSlide) {
    return (
      <div className="slide-app slide-app-error">
        <p>No slides available</p>
      </div>
    );
  }

  const step = currentSlide.step;

  // 複製 config 但關閉字幕（slides 模式不需要自動字幕）
  const slidesConfig = {
    ...episode.shell!.config,
    subtitle: {
      ...episode.shell!.config.subtitle,
      enabled: false, // 關閉自動字幕
    },
  };

  // 建立一個假的 audioSrc 給 StreamingLayout 讓 VTuber 顯示
  const dummyAudioSrc = currentSlide.audioSrc || 'shared/silence.mp3';

  // 計算當前和前一個 step 的 layoutMode
  const prevSlide = currentIndex > 0 ? slides[currentIndex - 1] : null;
  const prevStep = prevSlide?.step;
  
  const prevLayoutMode = prevStep?.layoutMode;
  const currentLayoutMode = step.layoutMode;

  return (
    <ThemeProvider theme={theme}>
    <div ref={appRef} className={`slide-app ${isFullscreen ? 'fullscreen' : ''}`} style={themeStyles}>
      {/* 完整重用 StreamingLayout + WebinarScene，畫面與影片一致 */}
      <div className="slide-viewport">
        <div ref={slideContainerRef} className="slide-content-wrapper">
          <StreamingLayout
            config={slidesConfig}
            decorationText={episodeInfo.decorationText}
            audioSrc={dummyAudioSrc}
            layoutMode={currentLayoutMode}
            prevLayoutMode={prevLayoutMode}
            backgroundPreset={step.backgroundPreset}
          >
            <WebinarScene
              step={step}
              episodeTitle={episodeInfo.title}
              episodeSubtitle={episodeInfo.subtitle}
              channelName={episodeInfo.channelName}
              episodeTag={episodeInfo.episodeTag}
            />
          </StreamingLayout>
          <ActionBar
            stepId={step.id}
            series={fallbackSeries}
            epId={fallbackEpId}
          />
        </div>

        {/* 講者備註（獨立顯示） */}
        {showNotes && step.narration && (
          <div className="slide-narration">
            <p>{step.narration}</p>
          </div>
        )}
      </div>

      {/* Slide Overview Panel */}
      {showOverview && (
        <div className="overview-backdrop" onClick={toggleOverview}>
          <div
            className="overview-panel"
            ref={overviewRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overview-header">
              <span className="overview-title">📑 Slide Overview</span>
              <span className="overview-count">{totalSlides} slides</span>
              <button className="overview-close" onClick={toggleOverview}>✕</button>
            </div>
            <div className="overview-grid">
              {slides.map((slide, idx) => {
                const s = slide.step;
                const isCurrent = idx === currentIndex;
                const typeIcon: Record<string, string> = {
                  cover: '🎬', text: '📝', code: '💻', image: '🖼️',
                  mermaid: '📊', markdown: '📄', summary: '📋', ticker: '📰',
                };
                return (
                  <button
                    key={slide.id}
                    className={`overview-card ${isCurrent ? 'active' : ''}`}
                    onClick={() => goTo(idx)}
                  >
                    <div className="overview-card-num">{idx + 1}</div>
                    {s.phase && <div className="overview-card-phase">{s.phase}</div>}
                    <div className="overview-card-title">
                      {typeIcon[s.contentType] || '📄'} {s.title || s.id}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 導航控制 */}
      <nav className="slide-navigation">
        <div className="nav-left">
          <button
            className="nav-btn"
            onClick={prev}
            disabled={currentIndex === 0}
            title="Previous (←)"
          >
            ←
          </button>
          <span className="nav-progress">
            {currentIndex + 1} / {totalSlides}
          </span>
          <button
            className="nav-btn"
            onClick={next}
            disabled={currentIndex === totalSlides - 1}
            title="Next (→)"
          >
            →
          </button>
        </div>

        <div className="nav-center">
          {currentSlide.audioSrc && (
            <>
              {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
              <audio
                ref={audioRef}
                src={`/${currentSlide.audioSrc}`}
                onEnded={handleAudioEnded}
                preload="auto"
              />
              <button className="nav-btn audio-btn" onClick={toggleAudio} title="Play/Pause Audio (P)">
                {isPlaying ? '⏸️' : '▶️'}
              </button>
            </>
          )}
        </div>

        <div className="nav-right">
          <div className="export-dropdown">
            <button
              className={`nav-btn export-btn ${isExporting ? 'exporting' : ''}`}
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              title="Export"
            >
              {isExporting ? '⏳' : '📤'}
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExport('pptx')}>📊 PPTX</button>
                <button onClick={() => handleExport('pdf')}>📄 PDF</button>
              </div>
            )}
          </div>
          <button
            className={`nav-btn ${showOverview ? 'active' : ''}`}
            onClick={toggleOverview}
            title="Slide Overview (G)"
          >
            🗂️
          </button>
          <button
            className={`nav-btn ${showNotes ? 'active' : ''}`}
            onClick={toggleNotes}
            title="Toggle Narration (N)"
          >
            📝
          </button>
          <button
            className="nav-btn"
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? '⬜' : '⬛'}
          </button>
        </div>

        <div className="nav-progress-bar">
          <div
            className="nav-progress-fill"
            style={{ width: `${((currentIndex + 1) / totalSlides) * 100}%` }}
          />
        </div>
      </nav>

      {/* 鍵盤提示 */}
      <div className="keyboard-hints">
        <span>← → Navigate</span>
        <span>P Play Audio</span>
        <span>F Fullscreen</span>
        <span>N Notes</span>
        <span>G Overview</span>
      </div>
    </div>
    </ThemeProvider>
  );
};

export default SlideApp;
