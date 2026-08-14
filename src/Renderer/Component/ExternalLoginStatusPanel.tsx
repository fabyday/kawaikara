import {
  Badge,
  Box,
  Head,
  Panel,
  Progress,
  Stack,
  Text,
} from '@kawaikara/kawai-ui';

export interface ExternalLoginStatusPanelProps {
  readonly siteTitle?: string;
  readonly title: string;
  readonly description: string;
  readonly waitingLabel: string;
  readonly secureLabel: string;
}

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
        <Box className="external-login-mark" aria-hidden="true">
          <Box className="external-login-mark-ring" />
          <Text className="external-login-mark-arrow" weight="semibold">
            ↗
          </Text>
        </Box>

        <Stack className="external-login-copy" align="center" gap="sm">
          <Badge dot tone="success">
            {secureLabel}
          </Badge>
          <Head level={1} size="lg">
            {title}
          </Head>
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
