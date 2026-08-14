import { Button } from '@kawaikara/kawai-ui';
import type {
  ApplicationLinkId,
  DeveloperYouTubeStatus,
} from '../../Common/IPC';

export interface DeveloperLinkMessages {
  readonly website: string;
  readonly github: string;
  readonly discord: string;
  readonly developerYouTube: string;
  readonly liveNow: string;
  readonly offline: string;
  readonly liveStatusUnavailable: string;
  readonly checkingLive: string;
}

export interface DeveloperLinksProps {
  readonly messages: DeveloperLinkMessages;
  readonly youtubeStatus?: DeveloperYouTubeStatus;
  readonly onOpen: (id: ApplicationLinkId) => void | Promise<void>;
}

export function DeveloperLinks({
  messages,
  youtubeStatus,
  onOpen,
}: DeveloperLinksProps) {
  const youtubeState = getYouTubeState(messages, youtubeStatus);

  return (
    <div className="developer-link-grid">
      <LinkButton
        icon={<WebsiteIcon />}
        label={messages.website}
        onClick={() => onOpen('website')}
      />
      <LinkButton
        className="github-link"
        icon={<GitHubIcon />}
        label={messages.github}
        onClick={() => onOpen('github')}
      />
      <LinkButton
        className="discord-link"
        icon={<DiscordIcon />}
        label={messages.discord}
        onClick={() => onOpen('discord')}
      />
      <Button
        aria-label={`${messages.developerYouTube}: ${youtubeState.label}`}
        className={`developer-link-button developer-youtube-link is-${youtubeState.kind}`}
        variant="ghost"
        onClick={() => void onOpen('developerYouTube')}
      >
        <span className="developer-link-icon youtube-icon-wrap">
          <YouTubeIcon />
          {youtubeState.kind === 'live' ? (
            <span aria-hidden="true" className="youtube-live-dot">
              <span />
            </span>
          ) : null}
        </span>
        <span className="developer-link-copy">
          <span className="developer-link-label">{messages.developerYouTube}</span>
          <span className="developer-youtube-status">
            <RadioIcon />
            {youtubeState.label}
          </span>
        </span>
        <ExternalLinkIcon />
      </Button>
    </div>
  );
}

function LinkButton({
  className,
  icon,
  label,
  onClick,
}: {
  readonly className?: string;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void | Promise<void>;
}) {
  return (
    <Button
      aria-label={label}
      className={`developer-link-button${className ? ` ${className}` : ''}`}
      variant="ghost"
      onClick={() => void onClick()}
    >
      <span className="developer-link-icon">{icon}</span>
      <span className="developer-link-label">{label}</span>
      <ExternalLinkIcon />
    </Button>
  );
}

function getYouTubeState(
  messages: DeveloperLinkMessages,
  status?: DeveloperYouTubeStatus,
): { readonly kind: 'checking' | 'live' | 'offline' | 'unavailable'; readonly label: string } {
  if (!status) return { kind: 'checking', label: messages.checkingLive };
  if (status.error) {
    return { kind: 'unavailable', label: messages.liveStatusUnavailable };
  }
  return status.isLive
    ? { kind: 'live', label: messages.liveNow }
    : { kind: 'offline', label: messages.offline };
}

function WebsiteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.2 2.45 3.3 5.45 3.3 9S14.2 18.55 12 21c-2.2-2.45-3.3-5.45-3.3-9S9.8 5.45 12 3Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 .7A11.3 11.3 0 0 0 8.43 22.72c.57.1.77-.25.77-.55v-2.16c-3.16.69-3.83-1.34-3.83-1.34-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.74.4-1.24.72-1.52-2.52-.29-5.17-1.26-5.17-5.59 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.44.11-3 0 0 .95-.3 3.11 1.16a10.8 10.8 0 0 1 5.67 0c2.16-1.46 3.1-1.16 3.1-1.16.62 1.56.23 2.71.11 3 .73.79 1.17 1.8 1.17 3.04 0 4.34-2.65 5.3-5.18 5.58.41.35.77 1.04.77 2.1v3.17c0 .3.21.66.78.55A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 127.14 96.36">
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21A105.73 105.73 0 0 0 32.71 96.36a77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.35 2.66-2.05a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.05a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10 9.1 5.2 2.9-5.2 2.9V9.1Z" />
    </svg>
  );
}

function RadioIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="2" />
      <path d="M4.8 4.8a4.5 4.5 0 0 0 0 6.4M11.2 4.8a4.5 4.5 0 0 1 0 6.4" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" className="developer-external-icon" viewBox="0 0 16 16">
      <path d="M6.25 3.25H3.5A1.5 1.5 0 0 0 2 4.75v7.75A1.5 1.5 0 0 0 3.5 14h7.75a1.5 1.5 0 0 0 1.5-1.5V9.75M9 2h5v5M14 2 7.25 8.75" />
    </svg>
  );
}
