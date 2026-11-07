/**
 * Reference implementation that forwards OSC 9 / OSC 777 desktop
 * notifications to the browser Notification API.
 *
 * ntwebterm itself only emits `onNotification`; whether and how to show
 * notifications is the embedder's decision. This helper is the simplest
 * reasonable policy: show a notification when the page already holds
 * permission, and never prompt unless asked to.
 *
 * @example
 * const subscription = forwardNotificationsToBrowser(term, { requestPermission: true });
 * // later
 * subscription.dispose();
 */
import type { IDisposable } from './interfaces';
import type { Terminal } from './terminal';

export interface ForwardNotificationsOptions {
  /**
   * Ask for permission on the first notification while it is still
   * 'default'. That notification is dropped; later ones show once granted.
   * Default: false, so the page never prompts on its own.
   */
  requestPermission?: boolean;
  /** Title used when the program sent none (OSC 9). Default: document.title. */
  defaultTitle?: string;
}

export function forwardNotificationsToBrowser(
  term: Terminal,
  options: ForwardNotificationsOptions = {}
): IDisposable {
  let asked = false;
  return term.onNotification((notification) => {
    if (typeof Notification === 'undefined') return;
    const title =
      notification.title ||
      options.defaultTitle ||
      (typeof document !== 'undefined' ? document.title : '') ||
      'Terminal';
    if (Notification.permission === 'granted') {
      new Notification(title, { body: notification.body });
      return;
    }
    if (Notification.permission === 'default' && options.requestPermission && !asked) {
      asked = true;
      Notification.requestPermission().catch(() => {});
    }
  });
}
