/**
 * Browser clipboard helpers shared by selection copy and OSC 52 writes.
 *
 * Strategy (modern APIs first):
 * 1. ClipboardItem API (works in Safari and modern browsers; Safari needs
 *    the item created synchronously within the user gesture)
 * 2. navigator.clipboard.writeText (modern async API)
 * 3. execCommand('copy') through a textarea (legacy fallback)
 */

/**
 * Copy text to the clipboard. `textarea` is used for the execCommand
 * fallback; when omitted a temporary offscreen one is created.
 */
export function writeTextToClipboard(text: string, textarea?: HTMLTextAreaElement): void {
  if (typeof navigator === 'undefined') return;
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const clipboardItem = new ClipboardItem({ 'text/plain': blob });
      navigator.clipboard.write([clipboardItem]).catch((err) => {
        console.warn('ClipboardItem write failed, trying writeText:', err);
        copyWithWriteText(text, textarea);
      });
      return;
    } catch {
      // ClipboardItem not supported or failed, fall through
    }
  }
  copyWithWriteText(text, textarea);
}

function copyWithWriteText(text: string, textarea?: HTMLTextAreaElement): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch((err) => {
      console.warn('Clipboard writeText failed, trying execCommand:', err);
      copyWithExecCommand(text, textarea);
    });
    return;
  }
  copyWithExecCommand(text, textarea);
}

function copyWithExecCommand(text: string, textarea?: HTMLTextAreaElement): void {
  if (typeof document === 'undefined') return;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const temporary = !textarea;
  const area = textarea ?? document.createElement('textarea');
  try {
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    area.style.width = '1px';
    area.style.height = '1px';
    area.style.opacity = '0';
    if (temporary) document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) console.warn('execCommand copy failed');
  } catch (err) {
    console.warn('execCommand copy threw:', err);
  } finally {
    if (temporary) area.remove();
    previouslyFocused?.focus();
  }
}
