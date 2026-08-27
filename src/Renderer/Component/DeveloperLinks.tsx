import { Button } from '@kawaikara/kawai-ui';
import type {
  ApplicationLinkId,
  DeveloperYouTubeStatus,
} from '../../Common/IPC';

/** Describes the developer link messages contract. */
export interface DeveloperLinkMessages {
  /** The website value. */
  readonly website: string;
  /** The github value. */
  readonly github: string;
  /** The discord value. */
  readonly discord: string;
  /** The developer you tube value. */
  readonly developerYouTube: string;
  /** The live now value. */
  readonly liveNow: string;
  /** The offline value. */
  readonly offline: string;
  /** The live status unavailable value. */
  readonly liveStatusUnavailable: string;
  /** The checking live value. */
  readonly checkingLive: string;
}

/** Describes the developer links props contract. */
export interface DeveloperLinksProps {
  /** The messages value. */
  readonly messages: DeveloperLinkMessages;
  /** The YouTube status value. */
  readonly youtubeStatus?: DeveloperYouTubeStatus;
  /** Callback used to handle on open. */
  readonly onOpen: (id: ApplicationLinkId) => void | Promise<void>;
}

/** Performs the developer links operation. */
export function DeveloperLinks({
  messages,
  youtubeStatus,
  onOpen,
}: DeveloperLinksProps) {
  const youtubeState = getYouTubeState(messages, youtubeStatus);

  return (
    <div className="developer-link-grid">
      <LinkButton
        displayLabel="Homepage"
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
        <span className="developer-link-label">YouTube</span>
        <span className="developer-youtube-status" title={youtubeState.label}>
          <RadioIcon />
        </span>
      </Button>
    </div>
  );
}

/** Performs the link button operation. */
function LinkButton({
  className,
  displayLabel,
  icon,
  label,
  onClick,
}: {
  /** The class name value. */
  readonly className?: string;
  /** The display label value. */
  readonly displayLabel?: string;
  /** The icon value. */
  readonly icon: React.ReactNode;
  /** The label value. */
  readonly label: string;
  /** Callback used to handle on click. */
  readonly onClick: () => void | Promise<void>;
}
) {
  return (
    <Button
      aria-label={label}
      className={`developer-link-button${className ? ` ${className}` : ''}`}
      variant="ghost"
      onClick={() => void onClick()}
    >
      <span className="developer-link-icon">{icon}</span>
      <span className="developer-link-label">{displayLabel ?? label}</span>
    </Button>
  );
}

/** Returns the you tube state. */
function getYouTubeState(
  messages: DeveloperLinkMessages,
  status?: DeveloperYouTubeStatus,
): {
  /** The kind value. */
  readonly kind: 'checking' | 'live' | 'offline' | 'unavailable';
  /** The label value. */
  readonly label: string;
} {
  if (!status) return {
    /** The kind value. */
    kind: 'checking',
    /** The label value. */
    label: messages.checkingLive,
  };
  if (status.error) {
    return {
      /** The kind value. */
      kind: 'unavailable',
      /** The label value. */
      label: messages.liveStatusUnavailable,
    };
  }
  return status.isLive
    ? {
      /** The kind value. */
      kind: 'live',
      /** The label value. */
      label: messages.liveNow,
    }
    : {
      /** The kind value. */
      kind: 'offline',
      /** The label value. */
      label: messages.offline,
    };
}

/** Performs the website icon operation. */
function WebsiteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.2 2.45 3.3 5.45 3.3 9S14.2 18.55 12 21c-2.2-2.45-3.3-5.45-3.3-9S9.8 5.45 12 3Z" />
    </svg>
  );
}

/** Performs the git hub icon operation. */
function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 .7A11.3 11.3 0 0 0 8.43 22.72c.57.1.77-.25.77-.55v-2.16c-3.16.69-3.83-1.34-3.83-1.34-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.74.4-1.24.72-1.52-2.52-.29-5.17-1.26-5.17-5.59 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.44.11-3 0 0 .95-.3 3.11 1.16a10.8 10.8 0 0 1 5.67 0c2.16-1.46 3.1-1.16 3.1-1.16.62 1.56.23 2.71.11 3 .73.79 1.17 1.8 1.17 3.04 0 4.34-2.65 5.3-5.18 5.58.41.35.77 1.04.77 2.1v3.17c0 .3.21.66.78.55A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

/** Performs the discord icon operation. */
function DiscordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 127.14 96.36">
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21A105.73 105.73 0 0 0 32.71 96.36a77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.35 2.66-2.05a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.05a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
}

/** Performs the you tube icon operation. */
function YouTubeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10 9.1 5.2 2.9-5.2 2.9V9.1Z" />
    </svg>
  );
}

/** Performs the radio icon operation. */
function RadioIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="2" />
      <path d="M4.8 4.8a4.5 4.5 0 0 0 0 6.4M11.2 4.8a4.5 4.5 0 0 1 0 6.4" />
    </svg>
  );
}
