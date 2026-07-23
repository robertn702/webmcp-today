// Contenteditable filling, ported from Joakim Selemyr's webmcp-extension (MIT).
// Rich-text editors (Lexical, Draft.js) ignore direct innerHTML writes — their
// EditorState never updates and submit buttons stay disabled — so dispatch a
// synthetic paste event and let the editor process it.

/** Returns the editable element (self or child), or null if not editable. */
export function findEditable(el: HTMLElement): HTMLElement | null {
  if (el.isContentEditable) return el;
  return el.querySelector<HTMLElement>('[contenteditable]:not([contenteditable="false"])');
}

export function fillContentEditable(editableEl: HTMLElement, value: unknown): void {
  editableEl.focus();

  // Select all existing content so the paste replaces it.
  const selectRange = document.createRange();
  selectRange.selectNodeContents(editableEl);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(selectRange);

  const dt = new DataTransfer();
  dt.setData("text/plain", String(value));
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  });
  editableEl.dispatchEvent(pasteEvent);

  // No editor handled the paste — plain contenteditable fallback.
  if (!pasteEvent.defaultPrevented) {
    editableEl.textContent = String(value);
    editableEl.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }),
    );
    // Move the cursor to the end (rich editors manage their own cursor).
    const range = document.createRange();
    range.selectNodeContents(editableEl);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }
}
