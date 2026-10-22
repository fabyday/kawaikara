import { Select } from '@kawaikara/kawai-ui';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';

/** Keeps the shared keyboard-operated Select above dialog/card clipping using the browser top layer. */
export function UnclippedSelect(props: ComponentProps<typeof Select>) {
    const root = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const container = root.current!;
        /** Positions the list within the viewport without moving it outside its modal DOM owner. */
        const position = () => {
            const trigger =
                container.querySelector<HTMLElement>('[role="combobox"]');
            const list =
                container.querySelector<HTMLElement>('[role="listbox"]');
            if (!trigger || !list) return;
            list.setAttribute('popover', 'manual');
            if (!list.matches(':popover-open')) list.showPopover();
            const rect = trigger.getBoundingClientRect();
            const above = Math.max(0, rect.top - 12);
            const below = Math.max(0, innerHeight - rect.bottom - 12);
            const top =
                below < Math.min(list.scrollHeight, 256) && above > below;
            Object.assign(list.style, {
                position: 'fixed',
                margin: '0',
                bottom: 'auto',
                right: 'auto',
                width: `${Math.min(rect.width, innerWidth - 16)}px`,
                maxHeight: `${Math.min(256, top ? above : below)}px`,
                left: `${Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8))}px`,
                top: `${top ? Math.max(8, rect.top - Math.min(list.scrollHeight, 256, above) - 4) : rect.bottom + 4}px`,
            });
        };
        const observer = new MutationObserver(position);
        observer.observe(container, { childList: true, subtree: true });
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
            window.removeEventListener('scroll', position, true);
        };
    }, []);
    return (
        <div ref={root}>
            <Select {...props} />
        </div>
    );
}
