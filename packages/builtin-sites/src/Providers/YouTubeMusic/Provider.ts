import {
  AbstractUrlProvider,
  matchesSiteUrlHost,
  provider,
  type NewWindowPolicy,
} from '@kawaikara/site-api';
import { repairIncompleteGoogleSession } from '../Google/SessionRepair';

/** Implements the you tube music site provider. */
@provider()
export class YouTubeMusicProvider extends AbstractUrlProvider {
  /** The URL value. */
  protected readonly url = 'https://music.youtube.com/';

  /** Performs the before load operation. */
  protected async beforeLoad(): Promise<void> {
    await repairIncompleteGoogleSession(this.context);
  }

  /** Handles the new window. */
  onNewWindow(url: string): NewWindowPolicy {
    if (matchesSiteUrlHost(url, [
      'accounts.google.com',
      'music.youtube.com',
      'youtube.com',
    ])) {
      return 'viewer';
    }
    return 'external';
  }
}
