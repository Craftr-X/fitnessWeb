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

// jsdom 未实现 ResizeObserver，Radix 的 Slider / Select 等组件依赖它测量尺寸
if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error 仅为满足 Radix 的调用，不做真实测量
  window.ResizeObserver = ResizeObserverStub
}
