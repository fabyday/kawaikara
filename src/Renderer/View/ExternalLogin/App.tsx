import { Center, KawaiProvider } from '@kawaikara/kawai-ui';
import { ExternalLoginStatusPanel } from '../../Component/ExternalLoginStatusPanel';
import en from '../../Locales/ExternalLogin/en.json';
import ja from '../../Locales/ExternalLogin/ja.json';
import ko from '../../Locales/ExternalLogin/ko.json';

interface ExternalLoginMessages {
  readonly title: string;
  readonly description: string;
  readonly waiting: string;
  readonly secure: string;
}

const MESSAGES: Readonly<Record<'en' | 'ko' | 'ja', ExternalLoginMessages>> = {
  en,
  ko,
  ja,
};

export function ExternalLoginView() {
  const parameters = new URLSearchParams(window.location.search);
  const siteTitle = parameters.get('site') || undefined;
  const locale = resolveLanguage(parameters.get('locale'));
  const messages = MESSAGES[locale];
  document.documentElement.lang = locale;

  return (
    <KawaiProvider>
      <Center className="kawai-theme-dark external-login-shell" fullHeight>
        <ExternalLoginStatusPanel
          siteTitle={siteTitle}
          title={messages.title}
          description={messages.description}
          waitingLabel={messages.waiting}
          secureLabel={messages.secure}
        />
      </Center>
    </KawaiProvider>
  );
}

function resolveLanguage(locale: string | null): 'en' | 'ko' | 'ja' {
  const requested = !locale || locale === 'system' ? navigator.language : locale;
  if (requested.toLowerCase().startsWith('ko')) return 'ko';
  if (requested.toLowerCase().startsWith('ja')) return 'ja';
  return 'en';
}
