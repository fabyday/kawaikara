import {
  Button,
  Flex,
  Select,
  Stack,
  Switch,
  Text
} from '@kawaikara/kawai-ui';
import {
  useState
} from 'react';
import type {
  AppMessages,
  DevelopmentBundleProjectInfo,
  DevelopmentState,
  DevToolsMode,
  PreferencePatch,
  PreferenceState
} from '../../../../Common/IPC';
import { NumberInput } from '../NumberInput';
import { devToolsModeOptions } from '../Logic/PreferenceOptions';

/** Performs the developer tab operation. */
export function DeveloperTab({
  actionId,
  developmentState,
  messages,
  notice,
  preferences,
  saving,
  onAddProject,
  onCopyVsCodeConfiguration,
  onDetachProject,
  onOpenDevTools,
  onRebuildProject,
  onSetHotReload,
  onUpdate,
}: {
  /** The action ID value. */
  readonly actionId?: string;
  /** The development state value. */
  readonly developmentState?: DevelopmentState;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The notice value. */
  readonly notice?: string;
  /** The preferences value. */
  readonly preferences: PreferenceState;
  /** Whether the saving option is enabled. */
  readonly saving: boolean;
  /** Callback used to handle on add project. */
  readonly onAddProject: () => Promise<void>;
  /** Callback used to handle on copy vs code configuration. */
  readonly onCopyVsCodeConfiguration: () => Promise<void>;
  /** Callback used to handle on detach project. */
  readonly onDetachProject: (projectId: string) => Promise<void>;
  /** Callback used to handle on open dev tools. */
  readonly onOpenDevTools: (mode: DevToolsMode) => Promise<void>;
  /** Callback used to handle on rebuild project. */
  readonly onRebuildProject: (projectId: string) => Promise<void>;
  /** Callback used to handle on set hot reload. */
  readonly onSetHotReload: (
    projectId: string,
    enabled: boolean,
  ) => Promise<void>;
  /** Callback used to handle on update. */
  readonly onUpdate: (patch: PreferencePatch) => void;
}
) {
  const [opening, setOpening] = useState(false);
  const debuggerState = developmentState?.debugger;
  const developmentBusy = saving || Boolean(actionId);

  /** Opens the operation. */
  const open = async () => {
    setOpening(true);
    try {
      await onOpenDevTools(preferences.devToolsMode);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Stack gap="lg">
      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.developmentMode}
        </Text>
        <div className="developer-tools-card">
          <Stack gap="md">
            <Switch
              checked={preferences.developmentMode}
              disabled={saving}
              label={messages.developmentMode}
              description={messages.developmentModeDescription}
              onCheckedChange={(developmentMode) =>
                onUpdate({
                  developmentMode
                })
              }
            />
            <Text className="development-trust-warning" size="xs">
              {messages.developmentTrustWarning}
            </Text>
          </Stack>
        </div>
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.mainProcessDebugger}
        </Text>
        <div className="developer-tools-card">
          <Stack gap="md">
            <Switch
              checked={preferences.developmentInspectorEnabled}
              disabled={saving || !preferences.developmentMode}
              label={messages.mainProcessDebugger}
              description={messages.mainProcessDebuggerDescription}
              onCheckedChange={(developmentInspectorEnabled) =>
                onUpdate({
                  developmentInspectorEnabled
                })
              }
            />
            <NumberInput
              description={messages.inspectorPortDescription}
              disabled={
                saving ||
                !preferences.developmentMode ||
                !preferences.developmentInspectorEnabled
              }
              label={messages.inspectorPort}
              min={1024}
              max={65535}
              step={1}
              value={preferences.developmentInspectorPort}
              onValueChange={(developmentInspectorPort) =>
                onUpdate({
                  developmentInspectorPort
                })
              }
            />
            <Text
              className={`development-debugger-status${debuggerState?.active ? ' is-active' : ''
                }`}
              size="xs"
              tone={debuggerState?.error ? 'danger' : 'muted'}
            >
              {debuggerState?.error ?? (
                debuggerState?.active
                  ? messages.debuggerActive
                    .replace('{address}', debuggerState.address)
                    .replace('{port}', String(debuggerState.port))
                  : messages.debuggerInactive
              )}
            </Text>
            <Flex justify="end">
              <Button
                disabled={developmentBusy || !preferences.developmentMode}
                isLoading={actionId === 'copy-vscode'}
                size="sm"
                variant="secondary"
                onClick={() => void onCopyVsCodeConfiguration()}
              >
                {messages.copyVsCodeConfiguration}
              </Button>
            </Flex>
            {notice ? (
              <Text className="development-notice" size="xs">
                {notice}
              </Text>
            ) : null}
          </Stack>
        </div>
      </section>

      <section>
        <Flex
          className="development-project-heading"
          align="center"
          justify="between"
          gap="md"
        >
          <div>
            <Text className="preference-section-title" weight="semibold">
              {messages.developmentBundles}
            </Text>
            <Text size="xs" tone="muted">
              {messages.developmentBundlesDescription}
            </Text>
          </div>
          <Button
            disabled={developmentBusy || !preferences.developmentMode}
            isLoading={actionId === 'attach'}
            size="sm"
            onClick={() => void onAddProject()}
          >
            {messages.addDevelopmentBundle}
          </Button>
        </Flex>
        <Stack className="development-project-list" gap="sm">
          {developmentState?.projects.length ? (
            developmentState.projects.map((project) => (
              <DevelopmentProjectCard
                actionId={actionId}
                disabled={developmentBusy || !preferences.developmentMode}
                key={project.id}
                messages={messages}
                project={project}
                onDetach={onDetachProject}
                onRebuild={onRebuildProject}
                onSetHotReload={onSetHotReload}
              />
            ))
          ) : (
            <Text size="sm" tone="muted">
              {messages.noDevelopmentBundles}
            </Text>
          )}
        </Stack>
      </section>

      <section>
        <Text className="preference-section-title" weight="semibold">
          {messages.developerTools}
        </Text>
        <div className="developer-tools-card">
          <Stack gap="md">
            <Text size="xs" tone="muted">
              {messages.developerToolsDescription}
            </Text>
            <Select
              disabled={saving || opening}
              label={messages.devToolsPlacement}
              options={devToolsModeOptions(messages)}
              value={preferences.devToolsMode}
              onValueChange={(devToolsMode) =>
                onUpdate({
                  devToolsMode: devToolsMode as DevToolsMode
                })
              }
            />
            <Flex
              className="developer-tools-actions"
              align="center"
              justify="between"
              gap="md"
            >
              <Switch
                checked={preferences.openDevToolsAutomatically}
                disabled={saving}
                label={messages.openDevToolsAutomatically}
                onCheckedChange={(openDevToolsAutomatically) =>
                  onUpdate({
                    openDevToolsAutomatically
                  })
                }
              />
              <Button
                disabled={saving}
                isLoading={opening}
                onClick={() => void open()}
              >
                {messages.openDevTools}
              </Button>
            </Flex>
          </Stack>
        </div>
      </section>
    </Stack>
  );
}

/** Performs the development project card operation. */
export function DevelopmentProjectCard({
  actionId,
  disabled,
  messages,
  project,
  onDetach,
  onRebuild,
  onSetHotReload,
}: {
  /** The action ID value. */
  readonly actionId?: string;
  /** Whether the disabled option is enabled. */
  readonly disabled: boolean;
  /** The messages value. */
  readonly messages: AppMessages;
  /** The project value. */
  readonly project: DevelopmentBundleProjectInfo;
  /** Callback used to handle on detach. */
  readonly onDetach: (projectId: string) => Promise<void>;
  /** Callback used to handle on rebuild. */
  readonly onRebuild: (projectId: string) => Promise<void>;
  /** Callback used to handle on set hot reload. */
  readonly onSetHotReload: (projectId: string, enabled: boolean) => Promise<void>;
}
) {
  const busy = project.status === 'building' || project.status === 'reloading';
  return (
    <div className={`development-project-card is-${project.status}`}>
      <Flex align="start" justify="between" gap="md">
        <div className="development-project-copy">
          <Text weight="semibold">{project.name}</Text>
          <Text size="xs" tone="muted">{project.projectPath}</Text>
          <Flex className="development-project-metadata" gap="sm">
            <span>{developmentStatusLabel(messages, project.status)}</span>
            {project.revision ? (
              <span>
                {messages.developmentRevision.replace(
                  '{revision}',
                  project.revision,
                )}
              </span>
            ) : null}
            <span>
              {messages.developmentOutputDirectory.replace(
                '{path}',
                project.outputDirectory,
              )}
            </span>
          </Flex>
        </div>
        <Switch
          checked={project.hotReload}
          disabled={disabled || busy}
          label={messages.hotReload}
          onCheckedChange={(enabled) =>
            void onSetHotReload(project.id, enabled)
          }
        />
      </Flex>
      {project.error ? (
        <Text className="development-project-error" size="xs" tone="danger">
          {project.error}
        </Text>
      ) : null}
      <Flex className="development-project-actions" justify="end" gap="sm">
        <Button
          disabled={disabled || busy}
          isLoading={actionId === `rebuild:${project.id}` || busy}
          size="sm"
          variant="secondary"
          onClick={() => void onRebuild(project.id)}
        >
          {messages.rebuildBundle}
        </Button>
        <Button
          disabled={disabled || busy}
          isLoading={actionId === `detach:${project.id}`}
          size="sm"
          variant="secondary"
          onClick={() => void onDetach(project.id)}
        >
          {messages.detachDevelopmentBundle}
        </Button>
      </Flex>
    </div>
  );
}

/** Performs the development status label operation. */
export function developmentStatusLabel(
  messages: AppMessages,
  status: DevelopmentBundleProjectInfo['status'],
): string {
  const labels: Record<DevelopmentBundleProjectInfo['status'], string> = {
    stopped: messages.developmentStatusStopped,
    watching: messages.developmentStatusWatching,
    building: messages.developmentStatusBuilding,
    reloading: messages.developmentStatusReloading,
    active: messages.developmentStatusActive,
    failed: messages.developmentStatusFailed,
  };
  return labels[status];
}
