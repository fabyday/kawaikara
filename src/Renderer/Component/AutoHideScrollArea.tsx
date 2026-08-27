import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEventHandler,
} from 'react';
import {
  ScrollArea,
  type ScrollAreaProps,
} from '@kawaikara/kawai-ui';

/** Defines the shared auto hide scrollbar delay ms constant. */
export const AUTO_HIDE_SCROLLBAR_DELAY_MS = 850;

/** Describes the auto hide scroll area props contract. */
interface AutoHideScrollAreaProps extends ScrollAreaProps {
  /** Whether the force scrollbar visible option is enabled. */
  readonly forceScrollbarVisible?: boolean;
}

/** Stores the auto hide scroll area value. */
export const AutoHideScrollArea = forwardRef<
  HTMLDivElement,
  AutoHideScrollAreaProps
>(function AutoHideScrollArea(
  {
    className,
    forceScrollbarVisible = false,
    onScroll,
    scrollbar: _scrollbar,
    tabIndex = -1,
    ...props
  },
  ref,
) {
  const [scrolling, setScrolling] = useState(false);
  const fadeTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (fadeTimer.current !== undefined) {
        window.clearTimeout(fadeTimer.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (fadeTimer.current !== undefined) {
      window.clearTimeout(fadeTimer.current);
      fadeTimer.current = undefined;
    }
    setScrolling(forceScrollbarVisible);
  }, [forceScrollbarVisible]);

  /** Handles the scroll. */
  const handleScroll: UIEventHandler<HTMLDivElement> = (event) => {
    onScroll?.(event);
    setScrolling(true);
    if (fadeTimer.current !== undefined) {
      window.clearTimeout(fadeTimer.current);
    }
    if (forceScrollbarVisible) return;
    fadeTimer.current = window.setTimeout(() => {
      fadeTimer.current = undefined;
      setScrolling(false);
    }, AUTO_HIDE_SCROLLBAR_DELAY_MS);
  };

  return (
    <ScrollArea
      {...props}
      ref={ref}
      className={`kawaikara-scroll-area${scrolling ? ' is-scrolling' : ''}${
        className ? ` ${className}` : ''
      }`}
      scrollbar="auto"
      tabIndex={tabIndex}
      onScroll={handleScroll}
    />
  );
});
