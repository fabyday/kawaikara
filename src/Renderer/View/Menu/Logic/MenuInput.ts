import type {
  AppMessages,
  PictureInPictureStatus
} from '../../../../Common/IPC';

/** Returns the picture in picture error. */
export function getPictureInPictureError(
  status: PictureInPictureStatus,
  messages: AppMessages,
): string {
  switch (status) {
    case 'no-video':
      return messages.pipNoVideo;
    case 'not-ready':
      return messages.pipNotReady;
    case 'disabled':
      return messages.pipDisabled;
    case 'unsupported':
      return messages.pipUnsupported;
    case 'failed':
      return messages.pipFailed;
    case 'entered':
    case 'exited':
      return '';
  }
}

/** Determines whether the editable keyboard target condition applies. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    'input',
    'textarea',
    'select',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="combobox"]',
    '[role="spinbutton"]',
  ].join(',')));
}
