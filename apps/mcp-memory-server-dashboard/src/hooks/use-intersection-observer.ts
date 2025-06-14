import { useEffect } from 'react';

interface UseIntersectionObserverProperties {
  target: React.RefObject<HTMLElement | null>;
  onIntersect: () => void;
  enabled?: boolean;
  rootMargin?: string;
  threshold?: number;
}

export function useIntersectionObserver({
  target,
  onIntersect,
  enabled = true,
  rootMargin = '0px',
  threshold = 0.1,
}: UseIntersectionObserverProperties) {
  useEffect(() => {
    if (!enabled || !target.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onIntersect();
          }
        }
      },
      {
        rootMargin,
        threshold,
      },
    );

    const element = target.current;
    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [target, enabled, rootMargin, threshold, onIntersect]);
}