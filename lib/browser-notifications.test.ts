import { afterEach, describe, expect, test } from 'bun:test';
import { forwardNotificationsToBrowser } from './browser-notifications';
import { Ghostty } from './ghostty';
import { Terminal } from './terminal';

type Shown = { title: string; options?: NotificationOptions };

/** Install a fake Notification API; returns the record of shown notifications. */
function fakeNotification(permission: NotificationPermission) {
  const shown: Shown[] = [];
  let requested = 0;
  class FakeNotification {
    static permission: NotificationPermission = permission;
    static async requestPermission(): Promise<NotificationPermission> {
      requested++;
      FakeNotification.permission = 'granted';
      return 'granted';
    }
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, options });
    }
  }
  (globalThis as { Notification?: unknown }).Notification = FakeNotification;
  return { shown, requested: () => requested };
}

const terminals: Terminal[] = [];
const savedNotification = (globalThis as { Notification?: unknown }).Notification;

async function open() {
  const term = new Terminal({ ghostty: await Ghostty.load(), cols: 20, rows: 4 });
  terminals.push(term);
  await term.open(document.createElement('div'));
  return term;
}

afterEach(() => {
  for (const term of terminals.splice(0)) term.dispose();
  (globalThis as { Notification?: unknown }).Notification = savedNotification;
});

describe('forwardNotificationsToBrowser', () => {
  test('shows a browser notification when permission is already granted', async () => {
    const fake = fakeNotification('granted');
    const term = await open();
    forwardNotificationsToBrowser(term);
    term.write('\x1b]777;notify;Build done;All tests passed\x07');
    expect(fake.shown).toEqual([{ title: 'Build done', options: { body: 'All tests passed' } }]);
    expect(fake.requested()).toBe(0);
  });

  test('falls back to the document title for OSC 9 notifications without one', async () => {
    const fake = fakeNotification('granted');
    document.title = 'My Terminal';
    const term = await open();
    forwardNotificationsToBrowser(term);
    term.write('\x1b]9;Hello\x07');
    expect(fake.shown).toEqual([{ title: 'My Terminal', options: { body: 'Hello' } }]);
  });

  test('never prompts unless requestPermission is enabled', async () => {
    const fake = fakeNotification('default');
    const term = await open();
    forwardNotificationsToBrowser(term);
    term.write('\x1b]9;Quiet\x07');
    expect(fake.shown).toEqual([]);
    expect(fake.requested()).toBe(0);
  });

  test('requests permission once when asked to, then shows later notifications', async () => {
    const fake = fakeNotification('default');
    const term = await open();
    forwardNotificationsToBrowser(term, { requestPermission: true });
    term.write('\x1b]9;First\x07');
    await Promise.resolve();
    term.write('\x1b]9;Second\x07');
    expect(fake.requested()).toBe(1);
    expect(fake.shown.map((n) => n.options?.body)).toEqual(['Second']);
  });

  test('stops forwarding when disposed', async () => {
    const fake = fakeNotification('granted');
    const term = await open();
    const subscription = forwardNotificationsToBrowser(term);
    subscription.dispose();
    term.write('\x1b]9;Gone\x07');
    expect(fake.shown).toEqual([]);
  });
});
