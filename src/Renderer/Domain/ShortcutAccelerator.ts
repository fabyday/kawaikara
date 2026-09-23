import { isApplePlatform } from './MenuOrder';

/** Formats an Electron accelerator as platform-native keycap labels. */
export function formatAccelerator(accelerator: string): string[] {
  const isApple = isApplePlatform();
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      const labels: Record<string, string> = isApple
        ? {
          commandorcontrol: '⌘',
          cmdorctrl: '⌘',
          command: '⌘',
          cmd: '⌘',
          control: '⌃',
          ctrl: '⌃',
          alt: '⌥',
          option: '⌥',
          shift: '⇧',
          super: '⌘',
        }
        : {
          commandorcontrol: 'Ctrl',
          cmdorctrl: 'Ctrl',
          command: 'Win',
          cmd: 'Win',
          control: 'Ctrl',
          ctrl: 'Ctrl',
          alt: 'Alt',
          option: 'Alt',
          shift: 'Shift',
          super: 'Win',
        };
      if (labels[normalized]) return labels[normalized];
      if (normalized === 'comma') return ',';
      if (normalized === 'space' || normalized === 'spacebar') return 'Space';
      if (part.length === 1) return part.toUpperCase();
      return part;
    });
}
