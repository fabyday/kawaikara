import { Center, KawaiProvider } from '@kawaikara/kawai-ui';
import { ExternalLoginStatusPanel } from './ExternalLoginStatusPanel';

/** Describes the external login view data contract. */
interface ExternalLoginViewData {
  /** The locale value. */
  readonly locale: string;
  /** The theme value. */
  readonly theme: 'dark' | 'light';
  /** The site title value. */
  readonly siteTitle?: string;
  /** The title value. */
  readonly title: string;
  /** The description value. */
  readonly description: string;
  /** The waiting value. */
  readonly waiting: string;
  /** The secure value. */
  readonly secure: string;
}

/** Performs the external login view operation. */
export function ExternalLoginView() {
  const data = readViewData();
  document.documentElement.lang = data.locale;

  return (
    <KawaiProvider>
      <Center
        className={`kawai-theme external-login-shell ${
          data.theme === 'dark' ? 'kawai-theme-dark' : 'kawai-theme-light'
        }`}
        fullHeight
      >
        <ExternalLoginStatusPanel
          siteTitle={data.siteTitle}
          title={data.title}
          description={data.description}
          waitingLabel={data.waiting}
          secureLabel={data.secure}
        />
      </Center>
    </KawaiProvider>
  );
}

/** Reads the view data. */
function readViewData(): ExternalLoginViewData {
  const serialized = new URLSearchParams(window.location.search).get('data');
  if (!serialized) throw new Error('External login view data was not provided.');
  return JSON.parse(serialized) as ExternalLoginViewData;
}
