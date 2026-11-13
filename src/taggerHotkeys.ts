import { Scope } from 'obsidian';

// Whether a key pressed in `target` types text. Uses `instanceOf` because the
// tagger may live in a popout, whose elements fail a plain `instanceof` check.
const isTextField = (target: EventTarget | null): boolean => {
    if (!(target && 'instanceOf' in target)) {
        return false;
    }

    const node = target as Node;
    return (
        node.instanceOf(HTMLInputElement) ||
        node.instanceOf(HTMLTextAreaElement) ||
        (node.instanceOf(HTMLElement) && node.isContentEditable)
    );
};

// Shift+S jumps to the person search. A text field keeps the key, so a
// capital S can still be typed into it.
export function registerFocusPersonSearchHotkey(scope: Scope, focusPersonSearch: () => void) {
    scope.register(['Shift'], 'S', (evt) => {
        if (isTextField(evt.target)) {
            return true;
        }

        focusPersonSearch();
        return false;
    });
}
