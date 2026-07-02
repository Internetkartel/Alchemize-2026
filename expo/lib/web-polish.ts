import { Platform } from 'react-native';

/**
 * Injects web-only CSS + meta tags to make the PWA feel like a native iPhone app:
 * no tap-highlight flashes, no rubber-band overscroll, crisp font rendering,
 * safe-area support, hidden scrollbars, and smooth momentum scrolling.
 */
export function applyWebPolish(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('alchemize-web-polish')) return;

  const style = document.createElement('style');
  style.id = 'alchemize-web-polish';
  style.textContent = `
    html, body {
      background-color: #0c0520;
      overscroll-behavior: none;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      height: 100%;
    }
    body {
      position: fixed;
      inset: 0;
      overflow: hidden;
      touch-action: pan-x pan-y;
    }
    * {
      -webkit-tap-highlight-color: transparent;
    }
    ::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
    * {
      scrollbar-width: none;
    }
    input, textarea, [contenteditable] {
      -webkit-user-select: text;
      user-select: text;
    }
    button, [role="button"], a {
      -webkit-user-select: none;
      user-select: none;
      cursor: pointer;
    }
    img {
      -webkit-user-drag: none;
      user-drag: none;
    }
    input, textarea, select {
      font-size: 16px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
  document.head.appendChild(style);

  ensureMeta('theme-color', '#0c0520');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('apple-mobile-web-app-title', 'Alchemize');
  ensureMeta('mobile-web-app-capable', 'yes');
  ensureViewport();
}

function ensureMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function ensureViewport(): void {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'viewport';
    document.head.appendChild(tag);
  }
  tag.content =
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
}
