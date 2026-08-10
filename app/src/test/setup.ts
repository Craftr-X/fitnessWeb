import '@testing-library/jest-dom/vitest'

// jsdom 未实现 matchMedia，sonner（Toaster）等组件依赖它判断深色主题
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
