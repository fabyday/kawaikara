import { useEffect, useRef, useState } from 'react';

export interface VideoThumbnailProps {
  readonly alt?: string;
  readonly className?: string;
  readonly loadThumbnail: (path: string) => Promise<string | undefined>;
  readonly path: string;
}

export function VideoThumbnail({
  alt = '',
  className,
  loadThumbnail,
  path,
}: VideoThumbnailProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState<string>();

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: '160px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [path]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setSource(undefined);
    void loadThumbnail(path)
      .then((next) => {
        if (active) setSource(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loadThumbnail, path, visible]);

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={`video-thumbnail${source ? ' has-image' : ''}${
        className ? ` ${className}` : ''
      }`}
      ref={hostRef}
    >
      {source ? <img alt={alt} draggable={false} src={source} /> : <span>▶</span>}
    </span>
  );
}
