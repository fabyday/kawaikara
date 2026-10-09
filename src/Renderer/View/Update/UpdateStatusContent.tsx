import { Flex, Head, Progress, Stack, Text } from '@kawaikara/kawai-ui';
import { motion, useIsPresent, useReducedMotion } from 'motion/react';
import type { UpdatePanelProps } from './Types';
import { formatBytes, formatProgress, getPhaseCopy, getProgressValue, versionSummary } from './UpdatePresentation';

/** Adds phase crossfades to the shared Stack without changing panel geometry. */
const MotionStack = motion.create(Stack);

/** Crossfades phase content without animating panel geometry or retaining interactive controls. */
export function UpdateStatusContent({ state, labels }: Pick<UpdatePanelProps, 'state' | 'labels'>) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  const copy = getPhaseCopy(state, labels);
  return (
    <MotionStack
      className="update-phase-content"
      data-exiting={!present || undefined}
      aria-hidden={!present || undefined}
      align="center"
      gap="sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeInOut' }}
    >
      <Stack className="update-heading" align="center" gap="xs" role={present ? 'status' : undefined} aria-atomic="true">
        <Flex className="update-status-title" align="center" justify="center" gap="sm">
          {state.phase === 'preparing' || state.phase === 'installing' ? <UpdateActivityRing /> : null}
          <Head level={1} size="lg">{copy.title}</Head>
        </Flex>
        {copy.description ? <Text size="sm" tone="muted">{copy.description}</Text> : null}
      </Stack>
      <Stack className="update-progress-block" gap="sm">
        <Progress aria-label={copy.title} value={getProgressValue(state)} />
        <Flex className="update-progress-meta" align="start" justify="between" gap="sm">
          <Text className="update-version-summary" size="xs" tone="muted">{versionSummary(state, labels)}</Text>
          {state.phase === 'downloading' && state.progress ? (
            <Text className="update-progress-summary" size="xs" tone="muted">
              {formatProgress(state.progress.percent)}
              {state.progress.total > 0
                ? ` · ${formatBytes(state.progress.transferred)} / ${formatBytes(state.progress.total)}`
                : ''}
            </Text>
          ) : null}
        </Flex>
      </Stack>
      {state.error ? <Text className="update-error-message" size="sm">{state.error}</Text> : null}
    </MotionStack>
  );
}

/** A short rounded stroke and fading tail travel continuously along the circular path. */
function UpdateActivityRing() {
  return (
    <svg className="update-activity-ring" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle className="update-activity-track" cx="16" cy="16" r="12" />
      <circle className="update-activity-tail" cx="16" cy="16" r="12" pathLength="100" />
      <circle className="update-activity-head" cx="16" cy="16" r="12" pathLength="100" />
    </svg>
  );
}
