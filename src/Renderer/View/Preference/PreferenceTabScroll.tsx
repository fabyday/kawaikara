import {
  type ReactNode
} from 'react';
import { AutoHideScrollArea } from '../../Component/AutoHideScrollArea';

/** Performs the preference tab scroll operation. */
export function PreferenceTabScroll({
  children,
  label,
}: {
  /** The children value. */
  readonly children: ReactNode;
  /** The label value. */
  readonly label: string;
}
) {
  return (
    <AutoHideScrollArea className="preference-tab-scroll" label={label}>
      <div className="preference-tab-content">{children}</div>
    </AutoHideScrollArea>
  );
}
