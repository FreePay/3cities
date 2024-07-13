import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGoBackWithFallback(fallbackPath: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackPath);
  }, [navigate, fallbackPath]);
}
