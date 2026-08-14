import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import Hls from 'hls.js';
import {
  Button,
  Flex,
  Input,
  KawaiProvider,
  Panel,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type { VideoOpenRequest } from '../../../Common/IPC';
import { YouTubeDownloaderPanel } from '../../Component/YouTubeDownloaderPanel';

export function VideoView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('No video selected');
  const [error, setError] = useState<string>();
  const [downloaderOpen, setDownloaderOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const clearSource = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const playNativeSource = useCallback((source: string) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.src = source;
    video.load();
    void video.play().catch(() => {
      // Autoplay may be disabled. Native controls remain available.
    });
  }, []);

  const applyOpenRequest = useCallback(
    (request: VideoOpenRequest) => {
      if (request.kind === 'youtube') {
        setYoutubeUrl(request.url);
        setDownloaderOpen(true);
        return;
      }
      clearSource();
      setError(undefined);
      setDownloaderOpen(false);
      setSourceLabel(request.displayName);
      playNativeSource(request.url);
    },
    [clearSource, playNativeSource],
  );

  useEffect(() => {
    let active = true;
    const unsubscribe = window.kawaikaraVideo.source.onOpenRequest((request) => {
      if (active) {
        applyOpenRequest(request);
      }
    });
    void window.kawaikaraVideo.source
      .getOpenRequest()
      .then((request) => {
        if (active && request) {
          applyOpenRequest(request);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : 'Could not open the video source.',
          );
        }
      });
    return () => {
      active = false;
      unsubscribe();
      clearSource();
    };
  }, [applyOpenRequest, clearSource]);

  const openLocalFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    clearSource();
    setError(undefined);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setSourceLabel(file.name);
    playNativeSource(objectUrl);
    event.target.value = '';
  };

  const openHlsStream = () => {
    const source = hlsUrl.trim();
    const video = videoRef.current;
    if (!source || !video) {
      return;
    }

    clearSource();
    setError(undefined);
    setSourceLabel(source);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      playNativeSource(source);
      return;
    }

    if (!Hls.isSupported()) {
      setError('HLS playback is not supported by this runtime.');
      return;
    }

    const hls = new Hls();
    hlsRef.current = hls;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setError(`HLS playback failed: ${data.details}`);
      }
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void video.play().catch(() => {
        // The user can start playback from the native controls.
      });
    });
    hls.loadSource(source);
    hls.attachMedia(video);
  };

  return (
    <KawaiProvider>
      <main className="kawai-theme-dark video-shell">
        <video ref={videoRef} className="video-player" controls playsInline />

        <div className="video-overlay-controls">
          {downloaderOpen ? (
            <YouTubeDownloaderPanel
              initialUrl={youtubeUrl}
              onClose={() => setDownloaderOpen(false)}
            />
          ) : null}

          <Panel className="video-toolbar" padding="sm" radius="lg">
            <Stack gap="sm">
              <Flex align="center" justify="between" gap="md">
                <div className="video-source-copy">
                  <Text size="xs" tone="muted">
                    Current source
                  </Text>
                  <Text
                    className="video-source-label"
                    size="sm"
                    weight="medium"
                  >
                    {sourceLabel}
                  </Text>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Open local video
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDownloaderOpen((open) => !open)}
                >
                  YouTube download
                </Button>
                <input
                  ref={fileInputRef}
                  className="video-file-input"
                  type="file"
                  accept="video/*,.mkv,.webm,.m4v"
                  onChange={openLocalFile}
                />
              </Flex>

              <Flex align="end" gap="sm">
                <Input
                  label="HLS stream URL"
                  placeholder="https://example.com/stream.m3u8"
                  value={hlsUrl}
                  onChange={(event) => setHlsUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      openHlsStream();
                    }
                  }}
                />
                <Button disabled={!hlsUrl.trim()} onClick={openHlsStream}>
                  Play
                </Button>
              </Flex>

              {error ? (
                <Text size="xs" tone="danger">
                  {error}
                </Text>
              ) : null}
            </Stack>
          </Panel>
        </div>
      </main>
    </KawaiProvider>
  );
}
