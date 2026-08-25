import { provider, type NewWindowPolicy } from '@kawaikara/site-api';
import { matchesUrlHost } from '../../SiteUtilities';
import { UrlProvider } from '../../UrlProvider';
import { repairIncompleteGoogleSession } from '../Google/SessionRepair';

@provider()
export class YouTubeMusicProvider extends UrlProvider {
  protected readonly url = 'https://music.youtube.com/';

  protected async beforeLoad(): Promise<void> {
    await repairIncompleteGoogleSession(this.context);
  }

  onNewWindow(url: string): NewWindowPolicy {
    if (matchesUrlHost(url, [
      'accounts.google.com',
      'music.youtube.com',
      'youtube.com',
    ])) {
      return 'viewer';
    }
    return 'external';
  }
}
