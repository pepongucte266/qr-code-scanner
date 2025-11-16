
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Theme } from './types';
import { ClipboardIcon, CopyIcon, ExternalLinkIcon, RefreshIcon, CheckCircleIcon, XCircleIcon, SunIcon, MoonIcon, UploadIcon } from './components/icons';

// Make jsQR available from the global scope (loaded via CDN)
declare const jsQR: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

const isUrl = (text: string): boolean => {
  try {
    new URL(text);
    return text.startsWith('http://') || text.startsWith('https://');
  } catch (_) {
    return false;
  }
};

const ThemeSwitcher: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void }> = ({ theme, setTheme }) => {
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
    </button>
  );
};

const Header: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void }> = ({ theme, setTheme }) => (
    <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center">
        <div />
        <ThemeSwitcher theme={theme} setTheme={setTheme} />
    </header>
);

const Footer: React.FC = () => (
    <footer className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            All processing happens in your browser. Your images are not uploaded to any server.
        </p>
    </footer>
);

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const reset = () => {
    setAppState(AppState.IDLE);
    setQrResult(null);
    setErrorMessage(null);
    setPastedImage(null);
    setIsCopied(false);
  };

  const processImageBlob = useCallback((blob: Blob) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPastedImage(e.target?.result as string);
    };
    reader.readAsDataURL(blob);

    setAppState(AppState.SCANNING);

    const imageUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(image, 0, 0, image.width, image.height);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        setQrResult(code.data);
        setAppState(AppState.SUCCESS);
      } else {
        setErrorMessage('No QR code found in this image. Please try with a clearer image.');
        setAppState(AppState.ERROR);
      }
      URL.revokeObjectURL(imageUrl);
    };
    image.onerror = () => {
        setErrorMessage('The image file is corrupted or not supported.');
        setAppState(AppState.ERROR);
        URL.revokeObjectURL(imageUrl);
    }
    image.src = imageUrl;
  }, []);
  
  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                processImageBlob(blob);
                break;
            }
        }
    }
  }, [processImageBlob]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImageBlob(file);
    }
    // Reset input to allow selecting the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleCopy = () => {
    if (qrResult) {
      navigator.clipboard.writeText(qrResult);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.IDLE:
        return (
          <div className="text-center">
            <div className="p-10 border-2 border-dashed border-light-border dark:border-dark-border rounded-xl flex flex-col items-center justify-center space-y-4">
                <ClipboardIcon className="w-16 h-16 text-accent"/>
                <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">Paste QR code image here</h2>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">Press Ctrl+V or Command+V to scan</p>
            </div>
            <div className="my-6 text-light-text-secondary dark:text-dark-text-secondary">or</div>
            <button onClick={handleUploadClick} className="px-6 py-3 bg-accent text-white font-semibold rounded-lg shadow-md hover:bg-accent-hover transition-all duration-200 inline-flex items-center space-x-2">
                <UploadIcon className="w-5 h-5"/>
                <span>Upload QR code</span>
            </button>
          </div>
        );
      case AppState.SCANNING:
        return (
          <div className="flex flex-col items-center space-y-6">
            {pastedImage && <img src={pastedImage} alt="Pasted QR code preview" className="max-w-xs max-h-64 rounded-lg shadow-lg object-contain" />}
            <div className="flex items-center space-x-3 text-light-text dark:text-dark-text">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xl font-medium">Scanning...</span>
            </div>
          </div>
        );
      case AppState.SUCCESS:
        return (
            <div className="w-full max-w-lg bg-light-card dark:bg-dark-card rounded-xl shadow-lg p-6 flex flex-col space-y-4">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Scan Result</h3>
                <div className="relative group p-4 bg-light-bg dark:bg-dark-bg rounded-lg text-light-text dark:text-dark-text font-mono text-sm max-h-48 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words pr-8">{qrResult}</pre>
                    <button 
                        onClick={handleCopy} 
                        className="absolute top-2 right-2 p-1.5 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-50 group-hover:opacity-100"
                        aria-label={isCopied ? "Copied" : "Copy result"}
                    >
                        {isCopied ? <CheckCircleIcon className="w-5 h-5 text-success"/> : <CopyIcon className="w-5 h-5"/>}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {qrResult && isUrl(qrResult) && (
                        <a href={qrResult} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 px-4 py-2 bg-light-text-secondary/10 dark:bg-dark-text-secondary/20 text-light-text-secondary dark:text-dark-text-secondary rounded-lg font-medium hover:bg-light-text-secondary/20 dark:hover:bg-dark-text-secondary/30 transition-colors">
                            <ExternalLinkIcon className="w-5 h-5"/>
                            <span>Open link</span>
                        </a>
                    )}
                </div>
                 <button onClick={reset} className="flex items-center justify-center space-x-2 w-full mt-4 px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary rounded-lg font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <RefreshIcon className="w-5 h-5"/>
                    <span>Scan new code</span>
                </button>
            </div>
        );
      case AppState.ERROR:
        return (
            <div className="w-full max-w-lg bg-red-50 dark:bg-error/10 border border-error/50 rounded-xl shadow-lg p-6 flex flex-col items-center text-center space-y-4">
                <XCircleIcon className="w-12 h-12 text-error"/>
                <h3 className="text-lg font-semibold text-error">An error occurred</h3>
                <p className="text-error/80">{errorMessage}</p>
                <button onClick={reset} className="flex items-center justify-center space-x-2 w-full mt-4 px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary rounded-lg font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <RefreshIcon className="w-5 h-5"/>
                    <span>Try again</span>
                </button>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen text-light-text dark:text-dark-text font-sans flex flex-col items-center justify-center p-4">
      <Header theme={theme} setTheme={setTheme} />
      <main className="w-full max-w-2xl flex flex-col items-center justify-center flex-grow">
        {renderContent()}
      </main>
      <Footer />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*"
      />
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};

export default App;
