import { serializePageInjectionWithOptions } from '../../Inject/Serialize';

interface ProviderIdentityOptions {
  readonly providerId: string;
}

function installProviderIdentity(options: ProviderIdentityOptions): void {
  document.documentElement.dataset.kawaikaraProvider = options.providerId;
}

export function createProviderIdentityInjectionScript(
  providerId: string,
): string {
  return serializePageInjectionWithOptions(installProviderIdentity, {
    providerId,
  });
}
