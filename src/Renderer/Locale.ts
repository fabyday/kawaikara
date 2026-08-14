import type { AppLocale } from '../Common/IPC';
import pipEn from './Locales/PictureInPicture/en.json';
import pipJa from './Locales/PictureInPicture/ja.json';
import pipKo from './Locales/PictureInPicture/ko.json';

export interface AppMessages {
  readonly chooseSite: string;
  readonly openPreferences: string;
  readonly closeMenu: string;
  readonly menuHint: string;
  readonly pictureInPicture: string;
  readonly automaticPictureInPicture: string;
  readonly gamePictureInPicture: string;
  readonly pictureInPictureSettings: string;
  readonly pictureInPictureSize: string;
  readonly pictureInPictureSizeDescription: string;
  readonly pictureInPicturePortraitSize: string;
  readonly pictureInPicturePortraitSizeDescription: string;
  readonly pipSizeCompact: string;
  readonly pipSizeMedium: string;
  readonly pipSizeLarge: string;
  readonly pipSizeCustom: string;
  readonly pipWidth: string;
  readonly pipHeight: string;
  readonly pixels: string;
  readonly pictureInPicturePosition: string;
  readonly pictureInPicturePositionDescription: string;
  readonly pipPositionTopLeft: string;
  readonly pipPositionTopRight: string;
  readonly pipPositionBottomLeft: string;
  readonly pipPositionBottomRight: string;
  readonly pipPositionLast: string;
  readonly pictureInPictureMonitor: string;
  readonly pictureInPictureMonitorDescription: string;
  readonly pipMonitorCurrent: string;
  readonly pipMonitorVideo: string;
  readonly pipMonitorLast: string;
  readonly pipMonitorDisplay: string;
  readonly primaryDisplay: string;
  readonly unavailableDisplay: string;
  readonly pipNoVideo: string;
  readonly pipNotReady: string;
  readonly pipDisabled: string;
  readonly pipUnsupported: string;
  readonly pipFailed: string;
  readonly selected: string;
  readonly preference: string;
  readonly configureViewer: string;
  readonly backToSites: string;
  readonly closePreferences: string;
  readonly general: string;
  readonly browserProfiles: string;
  readonly browserProfilesDescription: string;
  readonly browserProfile: string;
  readonly pluginProfiles: string;
  readonly userProfiles: string;
  readonly pluginProfile: string;
  readonly userProfile: string;
  readonly profileName: string;
  readonly profileNamePlaceholder: string;
  readonly addProfile: string;
  readonly removeProfile: string;
  readonly noUserProfiles: string;
  readonly persistentProfile: string;
  readonly siteProfileAssignments: string;
  readonly siteProfileAssignmentsDescription: string;
  readonly isolatedProfile: string;
  readonly isolatedProfileDescription: string;
  readonly sharedProfileDescription: string;
  readonly drmProfileWarning: string;
  readonly shortcuts: string;
  readonly appInfo: string;
  readonly viewer: string;
  readonly alwaysOnTop: string;
  readonly alwaysOnTopDescription: string;
  readonly openMenuOnStartup: string;
  readonly openMenuOnStartupDescription: string;
  readonly closeMenuOnEscape: string;
  readonly closeMenuOnEscapeDescription: string;
  readonly closeMenuOnOutsideClick: string;
  readonly closeMenuOnOutsideClickDescription: string;
  readonly menuOrder: string;
  readonly menuOrderDescription: string;
  readonly editMenuOrder: string;
  readonly menuOrderEditorDescription: string;
  readonly menuOrderCategories: string;
  readonly menuOrderSites: string;
  readonly dragToReorder: string;
  readonly resetMenuOrder: string;
  readonly done: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly automaticUpdates: string;
  readonly automaticUpdatesDescription: string;
  readonly defaultSite: string;
  readonly defaultSiteDescription: string;
  readonly language: string;
  readonly appLanguage: string;
  readonly appLanguageDescription: string;
  readonly globalLanguageDescription: string;
  readonly pluginLanguages: string;
  readonly siteLanguages: string;
  readonly inherit: string;
  readonly system: string;
  readonly korean: string;
  readonly english: string;
  readonly japanese: string;
  readonly appShortcuts: string;
  readonly menuCategoryShortcuts: string;
  readonly menuCategoryShortcutsDescription: string;
  readonly siteShortcuts: string;
  readonly shortcutCapture: string;
  readonly shortcutNames: Readonly<Record<string, string>>;
  readonly categoryLabels: Readonly<Record<string, string>>;
  readonly disabled: string;
  readonly empty: string;
  readonly duplicateShortcut: string;
  readonly reset: string;
  readonly defaultValue: string;
  readonly savedAutomatically: string;
  readonly unsavedChanges: string;
  readonly saveDescription: string;
  readonly saveChanges: string;
  readonly shortcutConflict: string;
  readonly shortcutConflictDescription: string;
  readonly cancel: string;
  readonly overwrite: string;
  readonly loading: string;
  readonly version: string;
  readonly appDescription: string;
  readonly channel: string;
  readonly stableChannel: string;
  readonly stagingChannel: string;
  readonly nightlyChannel: string;
  readonly checkForUpdates: string;
  readonly checkingForUpdates: string;
  readonly latestVersion: string;
  readonly updateAvailable: string;
  readonly updateUnavailable: string;
  readonly updateCheckFailed: string;
  readonly runtime: string;
  readonly platform: string;
  readonly developerLinks: string;
  readonly website: string;
  readonly github: string;
  readonly discord: string;
  readonly developerYouTube: string;
  readonly liveNow: string;
  readonly offline: string;
  readonly liveStatusUnavailable: string;
  readonly checkingLive: string;
  readonly installedPlugins: string;
  readonly sites: string;
}

const EN: AppMessages = {
  chooseSite: 'Choose a site to load',
  openPreferences: 'Open preferences',
  closeMenu: 'Close menu',
  menuHint: 'Press a number to jump to a category. Tab closes the menu.',
  ...pipEn,
  selected: 'Selected',
  preference: 'Preference',
  configureViewer: 'Configure the viewer',
  backToSites: 'Back to sites',
  closePreferences: 'Close preferences',
  general: 'General',
  browserProfiles: 'Browser profiles',
  browserProfilesDescription:
    'Profiles share sign-in and browser storage. Every site still runs in a fresh WebContents.',
  browserProfile: 'Browser profile',
  pluginProfiles: 'Plugin profiles',
  userProfiles: 'User profiles',
  pluginProfile: 'Plugin',
  userProfile: 'User',
  profileName: 'Profile name',
  profileNamePlaceholder: 'My media profile',
  addProfile: 'Add profile',
  removeProfile: 'Remove',
  noUserProfiles: 'No user profiles have been created.',
  persistentProfile: 'Keeps sign-in data across app restarts.',
  siteProfileAssignments: 'Site assignments',
  siteProfileAssignmentsDescription:
    'An isolated profile is safest. Select a shared profile only when you want sites to share sign-in state.',
  isolatedProfile: 'Isolated (recommended)',
  isolatedProfileDescription: 'Uses a persistent Session dedicated to this site.',
  sharedProfileDescription: 'Shares Session data through {profile}.',
  drmProfileWarning:
    'DRM site sharing can cause playback errors. An isolated profile is recommended.',
  shortcuts: 'Shortcuts',
  appInfo: 'App Info',
  viewer: 'Viewer',
  alwaysOnTop: 'Always on top',
  alwaysOnTopDescription: 'Keep the Kawaikara viewer above other windows.',
  openMenuOnStartup: 'Open menu on startup',
  openMenuOnStartupDescription: 'Show the site menu when Kawaikara starts.',
  closeMenuOnEscape: 'Close menu with Escape',
  closeMenuOnEscapeDescription: 'Close the site menu when Escape is pressed.',
  closeMenuOnOutsideClick: 'Close menu when clicking outside',
  closeMenuOnOutsideClickDescription:
    'Close the site menu when the viewer outside the menu is clicked.',
  menuOrder: 'Menu order',
  menuOrderDescription: 'Choose the order of categories and sites in the menu.',
  editMenuOrder: 'Edit order',
  menuOrderEditorDescription:
    'Drag by the handle or use the arrow buttons. Changes apply after saving preferences.',
  menuOrderCategories: 'Categories only',
  menuOrderSites: 'Sites by category',
  dragToReorder: 'Drag to reorder',
  resetMenuOrder: 'Reset order',
  done: 'Done',
  moveUp: 'Move up',
  moveDown: 'Move down',
  automaticUpdates: 'Automatic updates',
  automaticUpdatesDescription:
    'Check at startup and ask before downloading an available update. Off by default.',
  defaultSite: 'Default site',
  defaultSiteDescription: 'The site opened when Kawaikara starts.',
  language: 'Language',
  appLanguage: 'App language',
  appLanguageDescription: 'Language used by the Kawaikara interface.',
  globalLanguageDescription:
    'This one language setting is used by the app, plugins, and sites.',
  pluginLanguages: 'Plugin languages',
  siteLanguages: 'Site languages',
  inherit: 'Inherit',
  system: 'System',
  korean: '한국어',
  english: 'English',
  japanese: '日本語',
  appShortcuts: 'App shortcuts',
  menuCategoryShortcuts: 'Menu category shortcuts',
  menuCategoryShortcutsDescription:
    'These shortcuts only work while the site menu is open. Defaults follow the current category order.',
  siteShortcuts: 'Site shortcuts',
  shortcutCapture:
    'Select a shortcut, then press a key combination. Backspace clears it.',
  shortcutNames: {
    'app.toggle-menu': 'Open or close menu',
    'app.toggle-fullscreen': 'Toggle app fullscreen',
    'app.open-preferences': 'Open preferences',
    'app.toggle-always-on-top': 'Toggle always on top',
    'app.toggle-picture-in-picture': 'Toggle Picture in Picture',
    'app.reload-site': 'Reload current site',
    'app.go-back': 'Go back',
    'app.go-forward': 'Go forward',
  },
  categoryLabels: {
    OTT: 'OTT',
    Video: 'Video',
    Streaming: 'Live streaming',
    Music: 'Music',
    Books: 'Books',
  },
  disabled: 'Disabled',
  empty: 'Empty',
  duplicateShortcut: 'Duplicate shortcut',
  reset: 'Reset',
  defaultValue: 'Default',
  savedAutomatically: 'Changes are saved automatically.',
  unsavedChanges: 'Unsaved changes',
  saveDescription: 'Save to apply these preferences.',
  saveChanges: 'Save changes',
  shortcutConflict: 'Shortcut already in use',
  shortcutConflictDescription:
    'This shortcut is also assigned to {shortcuts}. Overwrite it?',
  cancel: 'Cancel',
  overwrite: 'Overwrite',
  loading: 'Loading preferences…',
  version: 'Version',
  appDescription: 'Streaming site viewer',
  channel: 'Channel',
  stableChannel: 'Stable',
  stagingChannel: 'Staging',
  nightlyChannel: 'Nightly',
  checkForUpdates: 'Check for updates',
  checkingForUpdates: 'Checking for updates…',
  latestVersion: 'You are using the latest version.',
  updateAvailable: 'Version {version} is available.',
  updateUnavailable: 'Update checks are available in an installed build.',
  updateCheckFailed: 'Could not check for updates.',
  runtime: 'Runtime',
  platform: 'Platform',
  developerLinks: 'Links',
  website: 'Kawaikara website',
  github: 'GitHub',
  discord: 'Discord',
  developerYouTube: 'Developer YouTube',
  liveNow: 'LIVE now',
  offline: 'Offline',
  liveStatusUnavailable: 'Status unavailable',
  checkingLive: 'Checking live status…',
  installedPlugins: 'Installed plugins',
  sites: 'sites',
};

const KO: AppMessages = {
  ...EN,
  ...pipKo,
  chooseSite: '불러올 사이트를 선택하세요',
  openPreferences: '설정 열기',
  closeMenu: '메뉴 닫기',
  menuHint: '숫자 키로 카테고리로 이동하고 Tab으로 메뉴를 닫습니다.',
  selected: '선택됨',
  preference: '설정',
  configureViewer: 'Kawaikara 뷰어 설정',
  backToSites: '사이트 메뉴로 돌아가기',
  closePreferences: '설정 닫기',
  general: '일반',
  browserProfiles: '브라우저 프로필',
  browserProfilesDescription:
    '프로필은 로그인과 브라우저 저장소를 공유합니다. 사이트의 WebContents는 항상 새로 생성됩니다.',
  browserProfile: '브라우저 프로필',
  pluginProfiles: '플러그인 프로필',
  userProfiles: '사용자 프로필',
  pluginProfile: '플러그인',
  userProfile: '사용자',
  profileName: '프로필 이름',
  profileNamePlaceholder: '내 미디어 프로필',
  addProfile: '프로필 추가',
  removeProfile: '삭제',
  noUserProfiles: '만든 사용자 프로필이 없습니다.',
  persistentProfile: '앱을 다시 시작해도 로그인 정보를 유지합니다.',
  siteProfileAssignments: '사이트 프로필 배정',
  siteProfileAssignmentsDescription:
    '독립 프로필이 가장 안전합니다. 사이트 간 로그인을 공유할 때만 공유 프로필을 선택하세요.',
  isolatedProfile: '사이트별 격리 (권장)',
  isolatedProfileDescription: '이 사이트만 사용하는 영구 Session입니다.',
  sharedProfileDescription: '{profile} 프로필을 통해 Session을 공유합니다.',
  drmProfileWarning:
    'DRM 사이트를 공유 프로필에 넣으면 재생 오류가 생길 수 있습니다. 사이트별 격리를 권장합니다.',
  shortcuts: '단축키',
  appInfo: '앱 정보',
  viewer: '뷰어',
  alwaysOnTop: '항상 위에 표시',
  alwaysOnTopDescription: 'Kawaikara를 다른 창보다 위에 유지합니다.',
  openMenuOnStartup: '시작할 때 메뉴 열기',
  openMenuOnStartupDescription: 'Kawaikara를 시작할 때 사이트 메뉴를 표시합니다.',
  closeMenuOnEscape: 'ESC로 메뉴 닫기',
  closeMenuOnEscapeDescription: 'ESC 키를 누르면 사이트 메뉴를 닫습니다.',
  closeMenuOnOutsideClick: '메뉴 바깥 클릭으로 닫기',
  closeMenuOnOutsideClickDescription:
    '메뉴 바깥의 뷰어 영역을 클릭하면 사이트 메뉴를 닫습니다.',
  menuOrder: '메뉴 순서',
  menuOrderDescription: '메뉴에 표시할 카테고리와 사이트 순서를 정합니다.',
  editMenuOrder: '순서 편집',
  menuOrderEditorDescription:
    '핸들을 드래그하거나 화살표 버튼을 사용하세요. 설정을 저장하면 실제 메뉴에 적용됩니다.',
  menuOrderCategories: '카테고리만',
  menuOrderSites: '카테고리별 사이트',
  dragToReorder: '드래그해서 순서 변경',
  resetMenuOrder: '기본 순서',
  done: '완료',
  moveUp: '위로 이동',
  moveDown: '아래로 이동',
  automaticUpdates: '자동 업데이트',
  automaticUpdatesDescription:
    '앱 시작 시 업데이트를 확인하고, 업데이트가 있으면 다운로드 전에 물어봅니다. 기본값은 꺼짐입니다.',
  defaultSite: '기본 사이트',
  defaultSiteDescription: 'Kawaikara 시작 시 열 사이트입니다.',
  language: '언어',
  appLanguage: '앱 언어',
  appLanguageDescription: 'Kawaikara 자체 UI에 사용하는 언어입니다.',
  globalLanguageDescription:
    '하나의 전역 언어 설정을 앱, 플러그인, 사이트에 함께 적용합니다.',
  pluginLanguages: '플러그인 언어',
  siteLanguages: '사이트 언어',
  inherit: '상위 설정 따름',
  system: '시스템',
  appShortcuts: '앱 단축키',
  menuCategoryShortcuts: '메뉴 카테고리 바로가기',
  menuCategoryShortcutsDescription:
    '사이트 메뉴가 열려 있을 때만 동작합니다. 기본 숫자 키는 현재 카테고리 순서를 따릅니다.',
  siteShortcuts: '사이트 이동 단축키',
  shortcutCapture:
    '단축키 칸을 선택한 뒤 원하는 키 조합을 누르세요. Backspace로 비울 수 있습니다.',
  shortcutNames: {
    'app.toggle-menu': '메뉴 열기 또는 닫기',
    'app.toggle-fullscreen': '앱 전체 화면 전환',
    'app.open-preferences': '설정 열기',
    'app.toggle-always-on-top': '항상 위에 표시 전환',
    'app.toggle-picture-in-picture': '화면 속 화면 전환',
    'app.reload-site': '현재 사이트 새로고침',
    'app.go-back': '뒤로 가기',
    'app.go-forward': '앞으로 가기',
  },
  categoryLabels: {
    OTT: 'OTT',
    Video: '영상',
    Streaming: '라이브',
    Music: '음악',
    Books: '도서',
  },
  disabled: '사용 안 함',
  empty: '없음',
  duplicateShortcut: '중복된 단축키',
  reset: '기본값',
  defaultValue: '기본값',
  savedAutomatically: '변경 사항은 자동으로 저장됩니다.',
  unsavedChanges: '저장하지 않은 변경 사항',
  saveDescription: '저장하면 변경한 설정이 적용됩니다.',
  saveChanges: '변경 사항 저장',
  shortcutConflict: '이미 사용 중인 단축키',
  shortcutConflictDescription:
    '이 단축키는 {shortcuts}에도 지정되어 있습니다. 기존 설정을 비우고 덮어쓸까요?',
  cancel: '취소',
  overwrite: '덮어쓰기',
  loading: '설정을 불러오는 중…',
  version: '버전',
  appDescription: '스트리밍 사이트 뷰어',
  channel: '채널',
  stableChannel: 'Stable',
  stagingChannel: 'Staging',
  nightlyChannel: 'Nightly',
  checkForUpdates: '업데이트 확인',
  checkingForUpdates: '업데이트를 확인하는 중…',
  latestVersion: '현재 최신 버전을 사용 중입니다.',
  updateAvailable: '{version} 버전을 사용할 수 있습니다.',
  updateUnavailable: '설치된 앱에서 업데이트를 확인할 수 있습니다.',
  updateCheckFailed: '업데이트를 확인하지 못했습니다.',
  runtime: '런타임',
  platform: '플랫폼',
  developerLinks: '개발자 및 커뮤니티',
  website: 'Kawaikara 사이트',
  github: 'GitHub',
  discord: '디스코드',
  developerYouTube: '개발자 유튜브',
  liveNow: '지금 라이브 중',
  offline: '현재 오프라인',
  liveStatusUnavailable: '상태 확인 불가',
  checkingLive: '라이브 확인 중…',
  installedPlugins: '설치된 플러그인',
  sites: '개 사이트',
};

const JA: AppMessages = {
  ...EN,
  ...pipJa,
  chooseSite: '読み込むサイトを選択してください',
  openPreferences: '設定を開く',
  closeMenu: 'メニューを閉じる',
  menuHint: '数字キーでカテゴリーへ移動し、Tabでメニューを閉じます。',
  selected: '選択中',
  preference: '設定',
  configureViewer: 'Kawaikaraビューアーの設定',
  backToSites: 'サイト一覧に戻る',
  closePreferences: '設定を閉じる',
  general: '一般',
  browserProfiles: 'ブラウザープロファイル',
  browserProfilesDescription:
    'プロファイルはログインとブラウザーストレージを共有します。サイトのWebContentsは毎回新しく作成されます。',
  browserProfile: 'ブラウザープロファイル',
  pluginProfiles: 'プラグインプロファイル',
  userProfiles: 'ユーザープロファイル',
  pluginProfile: 'プラグイン',
  userProfile: 'ユーザー',
  profileName: 'プロファイル名',
  profileNamePlaceholder: 'マイメディア',
  addProfile: '追加',
  removeProfile: '削除',
  noUserProfiles: 'ユーザープロファイルはありません。',
  persistentProfile: 'アプリを再起動してもログイン情報を保持します。',
  siteProfileAssignments: 'サイトの割り当て',
  siteProfileAssignmentsDescription:
    '分離プロファイルが最も安全です。ログインを共有する場合だけ共有プロファイルを選択してください。',
  isolatedProfile: 'サイト別に分離（推奨）',
  isolatedProfileDescription: 'このサイト専用の永続Sessionを使用します。',
  sharedProfileDescription: '{profile}でSessionを共有します。',
  drmProfileWarning:
    'DRMサイトの共有は再生エラーの原因になります。サイト別の分離を推奨します。',
  shortcuts: 'ショートカット',
  appInfo: 'アプリ情報',
  viewer: 'ビューアー',
  alwaysOnTop: '常に手前に表示',
  alwaysOnTopDescription: 'Kawaikaraを他のウィンドウより手前に保ちます。',
  openMenuOnStartup: '起動時にメニューを開く',
  openMenuOnStartupDescription: '起動時にサイトメニューを表示します。',
  closeMenuOnEscape: 'ESCでメニューを閉じる',
  closeMenuOnEscapeDescription: 'ESCキーを押すとサイトメニューを閉じます。',
  closeMenuOnOutsideClick: 'メニュー外のクリックで閉じる',
  closeMenuOnOutsideClickDescription:
    'メニュー外のビューアー領域をクリックするとサイトメニューを閉じます。',
  menuOrder: 'メニューの順序',
  menuOrderDescription: 'メニューに表示するカテゴリーとサイトの順序を設定します。',
  editMenuOrder: '順序を編集',
  menuOrderEditorDescription:
    'ハンドルをドラッグするか矢印ボタンを使用してください。保存後にメニューへ反映されます。',
  menuOrderCategories: 'カテゴリーのみ',
  menuOrderSites: 'カテゴリー別サイト',
  dragToReorder: 'ドラッグして並べ替え',
  resetMenuOrder: '既定の順序',
  done: '完了',
  moveUp: '上へ移動',
  moveDown: '下へ移動',
  automaticUpdates: '自動アップデート',
  automaticUpdatesDescription:
    '起動時にアップデートを確認し、ダウンロード前に確認します。初期設定はオフです。',
  defaultSite: '既定のサイト',
  defaultSiteDescription: 'Kawaikara起動時に開くサイトです。',
  language: '言語',
  appLanguage: 'アプリの言語',
  appLanguageDescription: 'KawaikaraのUIで使用する言語です。',
  globalLanguageDescription:
    '1つの言語設定をアプリ、プラグイン、サイトに適用します。',
  pluginLanguages: 'プラグインの言語',
  siteLanguages: 'サイトの言語',
  inherit: '上位設定を継承',
  system: 'システム',
  appShortcuts: 'アプリのショートカット',
  menuCategoryShortcuts: 'メニューカテゴリーのショートカット',
  menuCategoryShortcutsDescription:
    'サイトメニューが開いている間だけ動作します。既定の数字キーは現在のカテゴリー順に従います。',
  siteShortcuts: 'サイト移動ショートカット',
  shortcutCapture:
    'ショートカット欄を選択してキーの組み合わせを押してください。Backspaceで空にできます。',
  shortcutNames: {
    'app.toggle-menu': 'メニューを開く／閉じる',
    'app.toggle-fullscreen': 'アプリの全画面表示を切り替える',
    'app.open-preferences': '設定を開く',
    'app.toggle-always-on-top': '常に手前に表示を切り替える',
    'app.toggle-picture-in-picture': 'ピクチャーインピクチャーを切り替える',
    'app.reload-site': '現在のサイトを再読み込み',
    'app.go-back': '戻る',
    'app.go-forward': '進む',
  },
  categoryLabels: {
    OTT: 'OTT',
    Video: '動画',
    Streaming: 'ライブ配信',
    Music: '音楽',
    Books: '書籍',
  },
  disabled: '無効',
  empty: 'なし',
  duplicateShortcut: '重複したショートカット',
  reset: 'リセット',
  defaultValue: '既定値',
  savedAutomatically: '変更は自動的に保存されます。',
  unsavedChanges: '未保存の変更',
  saveDescription: '保存すると変更した設定が適用されます。',
  saveChanges: '変更を保存',
  shortcutConflict: '使用中のショートカット',
  shortcutConflictDescription:
    'このショートカットは{shortcuts}にも割り当てられています。上書きしますか？',
  cancel: 'キャンセル',
  overwrite: '上書き',
  loading: '設定を読み込み中…',
  version: 'バージョン',
  appDescription: 'ストリーミングサイトビューアー',
  channel: 'チャンネル',
  stableChannel: 'Stable',
  stagingChannel: 'Staging',
  nightlyChannel: 'Nightly',
  checkForUpdates: 'アップデートを確認',
  checkingForUpdates: 'アップデートを確認中…',
  latestVersion: '最新バージョンを使用しています。',
  updateAvailable: 'バージョン{version}を利用できます。',
  updateUnavailable: 'インストール済みアプリでアップデートを確認できます。',
  updateCheckFailed: 'アップデートを確認できませんでした。',
  runtime: 'ランタイム',
  platform: 'プラットフォーム',
  developerLinks: '開発者・コミュニティ',
  website: 'Kawaikaraサイト',
  github: 'GitHub',
  discord: 'Discord',
  developerYouTube: '開発者YouTube',
  liveNow: 'ライブ配信中',
  offline: 'オフライン',
  liveStatusUnavailable: '状態を確認できません',
  checkingLive: 'ライブ状況を確認中…',
  installedPlugins: 'インストール済みプラグイン',
  sites: 'サイト',
};

export function getAppMessages(locale: AppLocale): AppMessages {
  const resolved = locale === 'system' ? navigator.language : locale;
  if (resolved.toLowerCase().startsWith('ko')) return KO;
  if (resolved.toLowerCase().startsWith('ja')) return JA;
  return EN;
}
