import { KeyboardEvent, ReactNode, RefObject, useEffect, useId, useRef, useState } from 'react';

// Keyboard-navigable suggestion lists (the hashtag dropdown and the person
// search results). Both are comboboxes: text input on top, a highlighted row
// that moves with the arrow keys, Enter to commit it, Escape to hide the list.

export type SuggestionListState<T> = {
    isOpen: boolean;
    activeIndex: number;
    listboxId: string;
    optionId: (index: number) => string;
    activeItemRef: RefObject<HTMLDivElement>;
    setActiveIndex: (index: number) => void;
    commit: (item: T) => void;
    handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export function useSuggestionList<T>({
    items,
    onCommit,
    isAvailable = true,
}: {
    items: T[];
    onCommit: (item: T) => void;
    // Extra condition for showing the list, on top of "it has rows and hasn't
    // been dismissed" — the hashtag dropdown only shows while focused.
    isAvailable?: boolean;
}): SuggestionListState<T> {
    const [activeIndex, setActiveIndex] = useState(0);
    // Escape hides the list without clearing what has been typed.
    const [isDismissed, setIsDismissed] = useState(false);

    const activeItemRef = useRef<HTMLDivElement>(null);
    // Several tagger tabs can be open at once, so ids have to be unique per
    // instance for `aria-activedescendant` to resolve to the right row.
    const listboxId = useId();
    const optionId = (index: number) => `${listboxId}-option-${index}`;

    const isOpen = isAvailable && !isDismissed && items.length > 0;

    // A fresh set of rows always starts highlighted on the first one, so Enter
    // commits the best match without touching the arrow keys. Editing the
    // query also brings the list back after Escape.
    useEffect(() => {
        setActiveIndex(0);
        setIsDismissed(false);
    }, [items]);

    // Keep the highlighted row inside the scrollable list.
    useEffect(() => {
        if (isOpen) {
            activeItemRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (items.length === 0) {
                return;
            }

            e.preventDefault();
            setIsDismissed(false);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) => (index + step + items.length) % items.length);
            return;
        }

        if (e.key === 'Enter') {
            const activeItem = isOpen ? items[activeIndex] : undefined;
            if (activeItem === undefined) {
                return;
            }

            e.preventDefault();
            onCommit(activeItem);
            return;
        }

        if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            setIsDismissed(true);
        }
    };

    return {
        isOpen,
        activeIndex,
        listboxId,
        optionId,
        activeItemRef,
        setActiveIndex,
        commit: onCommit,
        handleKeyDown,
    };
}

// The ARIA wiring for the text input driving a suggestion list.
export function comboboxProps<T>(list: SuggestionListState<T>) {
    return {
        role: 'combobox',
        'aria-expanded': list.isOpen,
        'aria-controls': list.listboxId,
        'aria-autocomplete': 'list',
        'aria-activedescendant': list.isOpen ? list.optionId(list.activeIndex) : undefined,
    } as const;
}

export const SuggestionList = <T,>({
    list,
    items,
    getKey,
    getLabel,
    getItemClassName,
    className,
    preserveFocus = false,
}: {
    list: SuggestionListState<T>;
    items: T[];
    getKey: (item: T) => string;
    getLabel: (item: T) => ReactNode;
    getItemClassName?: (item: T) => string;
    className: string;
    // Keeps the caret in the input when a row is clicked, for lists that are
    // only shown while the input has focus.
    preserveFocus?: boolean;
}) => {
    if (!list.isOpen) {
        return null;
    }

    return (
        <div
            id={list.listboxId}
            role="listbox"
            className={className}
            // Clicking a row must not blur the input: that would close the
            // list before the click lands.
            onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
        >
            {items.map((item, index) => (
                <div
                    key={getKey(item)}
                    id={list.optionId(index)}
                    ref={index === list.activeIndex ? list.activeItemRef : undefined}
                    role="option"
                    aria-selected={index === list.activeIndex}
                    className={[
                        'suggestion-item',
                        'photo-tagging-suggestion-item',
                        getItemClassName?.(item) ?? '',
                        index === list.activeIndex ? 'is-selected' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => list.commit(item)}
                    onMouseMove={() => list.setActiveIndex(index)}
                >
                    {getLabel(item)}
                </div>
            ))}
        </div>
    );
};
