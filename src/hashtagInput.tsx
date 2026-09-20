import { getIcon } from 'obsidian';
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

// A row of the suggestions dropdown: either a hashtag that already exists
// somewhere in the vault, or the trailing row that creates a brand new one.
type Suggestion = {
    kind: 'existing' | 'create';
    name: string;
};

export const HashtagInput = ({
    hashtags,
    setHashtags,
    allHashtagNames,
}: {
    hashtags: string[];
    setHashtags: (hashtags: string[]) => void;
    allHashtagNames: string[];
}) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    // Escape hides the dropdown without clearing what has been typed. Any
    // edit or arrow key brings it back.
    const [isDismissed, setIsDismissed] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const activeItemRef = useRef<HTMLDivElement>(null);
    // Several tagger tabs can be open at once, so the listbox id has to be
    // unique per component instance for `aria-activedescendant` to resolve.
    const listboxId = useId();
    const optionId = (index: number) => `${listboxId}-option-${index}`;

    const suggestions = useMemo<Suggestion[]>(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }

        const q = trimmed.toLowerCase();
        const existing = allHashtagNames
            .filter((name) => name.toLowerCase().includes(q) && !hashtags.includes(name))
            .map((name): Suggestion => ({ kind: 'existing', name }));

        const isKnown = allHashtagNames.some((name) => name.toLowerCase() === q);
        if (isKnown || hashtags.includes(trimmed)) {
            return existing;
        }

        return [...existing, { kind: 'create', name: trimmed }];
    }, [query, allHashtagNames, hashtags]);

    const isOpen = isFocused && !isDismissed && suggestions.length > 0;
    const activeSuggestion = isOpen ? suggestions[activeIndex] : undefined;

    // The first row is always the highlighted one for a fresh query, so Enter
    // commits the best match without touching the arrow keys.
    useEffect(() => {
        setActiveIndex(0);
    }, [suggestions]);

    // Keep the highlighted row inside the scrollable dropdown.
    useEffect(() => {
        if (isOpen) {
            activeItemRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);

    const addHashtag = (name: string) => {
        if (!hashtags.includes(name)) {
            setHashtags([...hashtags, name]);
        }

        setQuery('');
        setActiveIndex(0);
        setIsDismissed(false);
        // Return the caret to the input so the next hashtag can be typed right
        // away, whether this one was picked with the mouse or with Enter.
        inputRef.current?.focus();
    };

    const removeHashtag = (name: string) => {
        setHashtags(hashtags.filter((hashtagName) => hashtagName !== name));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (suggestions.length === 0) {
                return;
            }

            e.preventDefault();
            setIsDismissed(false);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
            return;
        }

        if (e.key === 'Enter') {
            if (!activeSuggestion) {
                return;
            }

            e.preventDefault();
            addHashtag(activeSuggestion.name);
            return;
        }

        if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            setIsDismissed(true);
        }
    };

    return (
        <div className="photo-tagging-hashtag-input">
            <div className="photo-tagging-hashtag-input-field">
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    placeholder="Add hashtag..."
                    value={query}
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeSuggestion ? optionId(activeIndex) : undefined}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsDismissed(false);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                />
                {isOpen && (
                    <div
                        id={listboxId}
                        role="listbox"
                        className="photo-tagging-suggestions-dropdown"
                        // Picking a suggestion must not blur the input: that
                        // would close the dropdown before the click lands.
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={`${suggestion.kind}:${suggestion.name}`}
                                id={optionId(index)}
                                ref={index === activeIndex ? activeItemRef : undefined}
                                role="option"
                                aria-selected={index === activeIndex}
                                className={[
                                    'suggestion-item',
                                    'photo-tagging-suggestion-item',
                                    suggestion.kind === 'create'
                                        ? 'photo-tagging-suggestion-create'
                                        : '',
                                    index === activeIndex ? 'is-selected' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                onClick={() => addHashtag(suggestion.name)}
                                onMouseMove={() => setActiveIndex(index)}
                            >
                                {suggestion.kind === 'create'
                                    ? `Create «${suggestion.name}»`
                                    : `#${suggestion.name}`}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="photo-tagging-hashtag-chips">
                {hashtags.map((ht) => (
                    <span key={ht} className="photo-tagging-hashtag-chip">
                        #{ht}
                        <button
                            className="photo-tagging-delete-button"
                            onClick={() => removeHashtag(ht)}
                            aria-label={`Remove hashtag ${ht}`}
                            title={`Remove hashtag ${ht}`}
                            dangerouslySetInnerHTML={{
                                __html: getIcon('x')?.outerHTML || '',
                            }}
                        />
                    </span>
                ))}
            </div>
        </div>
    );
};
