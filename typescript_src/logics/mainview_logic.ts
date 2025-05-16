import { BrowserWindow, Rectangle } from 'electron';
import { global_object } from '../data/context';
import { KawaiContext } from '../definitions/context';

/**
 * rollback to default view mode.
 * it doesn't modify view sizes and location.
 * it only manipulate modes.
 * @see save_view_bounds
 * @see rollback_bounds
 * @param view
 * @param context
 * @returns
 */
export function disable_current_viewmode(
    view: BrowserWindow,
    context: KawaiContext,
) {
    const current_mode = context.window_mode;
    const previous_mode = context.saved_window_mode;

    // if previous mode not exists then do nothing.
    if (typeof current_mode === 'undefined' || current_mode === 'default') {
        return;
    }

    switch (current_mode) {
        case 'always_on_top':
            disable_always_on_top(view, context);
            break;
        case 'fullscreen':
            disable_fullscreen(view, context);
            break;
        case 'pip':
            disable_pipmode(view, context);
            break;
    }
}

export function save_view_bounds(view: BrowserWindow, context: KawaiContext) {
    context.current_window_bounds = view.getBounds();
}
export function rollback_bounds(view: BrowserWindow, context: KawaiContext) {
    if (context.current_window_bounds) {
        const { x, y, width, height } = context.current_window_bounds;
        view.setSize(width, height, true);
        view.setPosition(x, y, true);
    }
    // else do nothing.
}

export function eanble_default(view: BrowserWindow, context: KawaiContext) {
    disable_current_viewmode(view, context);
    context.saved_window_mode = undefined;
    rollback_bounds(view, context);
    context.saved_window_mode = 'default';
}

export function enable_pipmode(
    view: BrowserWindow,
    context: KawaiContext,
    Bounds: Rectangle,
) {
    disable_current_viewmode(view, context);

    if (context.window_mode === 'default') {
        save_view_bounds(view, context);
    }

    // if (context.window_mode === 'pip') {
    //     if (view.getBounds() !== Bounds) {
    //         disable_pipmode(view, context);
    //         view.setBounds(Bounds);
    //     }
    // }
    view.setMinimumSize(Bounds.width, Bounds.height);
    view.setBounds(Bounds, true);
    view.setMovable(false);
    view.setResizable(false);
    view.setAlwaysOnTop(true);
    context.window_mode = 'pip';
}

export function disable_pipmode(view: BrowserWindow, context: KawaiContext) {
    view.setMovable(true);
    view.setResizable(true);
    view.setAlwaysOnTop(false);
}

export function enable_fullscreen(view: BrowserWindow, context: KawaiContext) {
    disable_current_viewmode(view, context);
    view.setFullScreenable(true);
    view.setFullScreen(true);
    context.window_mode = 'fullscreen';
}
export function disable_fullscreen(view: BrowserWindow, context: KawaiContext) {
    view.setFullScreen(false);
    view.setFullScreenable(false);
}

export function eanble_always_on_top(
    view: BrowserWindow,
    context: KawaiContext,
) {
    disable_current_viewmode(view, context);

    view.setMovable(true);
    view.setResizable(true);
    view.setAlwaysOnTop(true);
    context.window_mode = 'always_on_top';
}
export function disable_always_on_top(
    view: BrowserWindow,
    context: KawaiContext,
) {
    view.setAlwaysOnTop(false);
}
