import { app } from 'electron';
import { initializeApplication } from './Functional/ApplicationInitialization';
import { postInitializeApplication } from './Functional/ApplicationPostInitialization';
import { preInitializeApplication } from './Functional/ApplicationPreInitialization';
import { ApplicationLifecycleManager } from './Manager/ApplicationLifecycleManager';

/** Stores the pre initialized value. */
const preInitialized = preInitializeApplication();
/** Stores the lifecycle value. */
const lifecycle = new ApplicationLifecycleManager(
  preInitialized.logging,
  preInitialized.applicationLog,
);

if (lifecycle.start()) {
  void app.whenReady()
    .then(async () => {
      const initialized = await initializeApplication(preInitialized);
      lifecycle.attachRuntime({
        updates: initialized.updates,
        dispose: () => initialized.dispose(),
      });
      await postInitializeApplication(initialized, lifecycle);
    })
    .catch((error: unknown) => {
      preInitialized.applicationLog.error('Kawaikara failed to start.', error);
      app.quit();
    });
}
