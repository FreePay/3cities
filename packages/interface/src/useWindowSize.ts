import { useState, useEffect, useCallback } from 'react';

export type WindowSize = {
  width: number;
  height: number;
}

function getWindowSize(): WindowSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export default function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>(getWindowSize);

  const handleResize = useCallback(() => {
    setWindowSize(getWindowSize());
  }, [setWindowSize]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return windowSize;
}
