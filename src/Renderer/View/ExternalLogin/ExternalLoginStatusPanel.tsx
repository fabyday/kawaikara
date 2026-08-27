import {
  Badge,
  Head,
  Panel,
  Progress,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';
import type { CSSProperties } from 'react';
import kawaikaraCharacter from '../../../../resources/icons/kawaikara_banner.png';

/** Describes the external login status panel props contract. */
export interface ExternalLoginStatusPanelProps {
  /** The site title value. */
  readonly siteTitle?: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description: string;
  /** The waiting label value. */
  readonly waitingLabel: string;
  /** The secure label value. */
  readonly secureLabel: string;
}

/** Performs the external login status panel operation. */
export function ExternalLoginStatusPanel({
  siteTitle,
  title,
  description,
  waitingLabel,
  secureLabel,
}: ExternalLoginStatusPanelProps) {
  return (
    <Panel className="external-login-panel" padding="lg" radius="lg">
      <Stack align="center" gap="lg">
        <div className="external-login-hero">
          <img
            className="external-login-character"
            src={kawaikaraCharacter}
            alt=""
          />
          <Head className="external-login-wave-title" level={1} size="lg">
            <span className="external-login-wave-label">{title}</span>
            <span aria-hidden="true">
              {Array.from(title).map((character, index) => (
                <span
                  className="external-login-wave-character"
                  key={`${character}-${index}`}
                  style={{ '--wave-index': index
                  } as CSSProperties}
                >
                  {character === ' ' ? '\u00a0' : character}
                </span>
              ))}
            </span>
          </Head>
        </div>

        <Stack className="external-login-copy" align="center" gap="sm">
          <Badge dot tone="success">
            {secureLabel}
          </Badge>
          <Text tone="muted">{description}</Text>
        </Stack>

        <Stack className="external-login-progress" gap="sm">
          <Progress aria-label={waitingLabel} value={null} />
          <Text size="xs" tone="muted">
            {siteTitle ? `${waitingLabel} · ${siteTitle}` : waitingLabel}
          </Text>
        </Stack>
      </Stack>
    </Panel>
  );
}
