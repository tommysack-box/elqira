declare const __APP_VERSION__: string;

interface ElqiraDesktopBridge {
  isElectron: boolean;
  platform: string;
  hasCustomTitleBar: boolean;
  windowControlsMode: 'custom' | 'native-overlay';
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<boolean>;
  onWindowMaximizedChange: (listener: (isMaximized: boolean) => void) => () => void;
}

interface Window {
  elqiraDesktop?: ElqiraDesktopBridge;
}
