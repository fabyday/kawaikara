import {
  Badge,
  Button,
  Flex,
  Head,
  Panel,
  Stack,
  Text
} from '@kawaikara/kawai-ui';
import type {
  ApplicationUpdatePanelState
} from '../../../Common/IPC';
import { UpdatePanelLabels } from './Types';
import { formatChannel, versionSummary } from './UpdatePresentation';

/** Updates the release notes view. */
export function UpdateReleaseNotesView({
  labels,
  notes,
  state,
  onBack,
}: {
  /** The labels value. */
  readonly labels: UpdatePanelLabels;
  /** The notes value. */
  readonly notes: string;
  /** The state value. */
  readonly state: ApplicationUpdatePanelState;
  /** Callback used to handle on back. */
  readonly onBack: () => void;
}
) {
  return (
    <main className={`update-shell is-${state.origin}`}>
      <Panel
        className="update-panel update-release-notes-panel"
        padding="lg"
        radius="lg"
      >
        <div className="update-release-notes-layout">
          <Flex className="update-release-notes-header" align="center" gap="md">
            <Button aria-label={labels.back} variant="ghost" onClick={onBack}>
              <span aria-hidden="true">←</span>
            </Button>
            <Stack gap="xs">
              <Head level={1} size="lg">{labels.releaseNotes}</Head>
              <Text size="sm" tone="muted">
                {labels.releaseNotesDescription}
              </Text>
            </Stack>
          </Flex>

          <Flex className="update-release-notes-meta" align="center" gap="sm">
            <Badge dot tone="primary">
              {labels.channel}: {formatChannel(state.channel, labels)}
            </Badge>
            <Text size="xs" tone="muted">
              {versionSummary(state, labels)}
            </Text>
          </Flex>

          <section
            className="update-release-notes-scroll"
            aria-label={labels.releaseNotes}
          >
            <ReleaseNotesContent notes={notes} />
          </section>
        </div>
      </Panel>
    </main>
  );
}

/** Performs the release notes content operation. */
export function ReleaseNotesContent({ notes }: {
  /** The notes value. */
  readonly notes: string;
}
) {
  return (
    <div className="update-release-notes-copy">
      {notes.split(/\r?\n/).map((line, index) => {
        const trimmed = line.trim();
        const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);
        if (heading) return <h2 key={index}>{plainMarkdown(heading[1])}</h2>;
        const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
        if (bullet) {
          return (
            <div className="update-release-note-bullet" key={index}>
              <span aria-hidden="true">•</span>
              <span>{plainMarkdown(bullet[1])}</span>
            </div>
          );
        }
        if (!trimmed || /^-{3,}$/.test(trimmed)) {
          return <div className="update-release-note-space" key={index} />;
        }
        return <p key={index}>{plainMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

/** Performs the plain markdown operation. */
export function plainMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}
