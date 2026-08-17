import { Center, KawaiProvider } from '@kawaikara/kawai-ui';
import { ExternalLoginStatusPanel } from './ExternalLoginStatusPanel';

interface ExternalLoginViewData {
  readonly locale: string;
  readonly theme: 'dark' | 'light';
  readonly siteTitle?: string;
  readonly title: string;
  readonly description: string;
  readonly waiting: string;
  readonly secure: string;
}

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

function readViewData(): ExternalLoginViewData {
  const serialized = new URLSearchParams(window.location.search).get('data');
  if (!serialized) throw new Error('External login view data was not provided.');
  return JSON.parse(serialized) as ExternalLoginViewData;
}
