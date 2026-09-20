import { getIcon } from 'obsidian';
import { useMemo, useRef, useState } from 'react';

import { comboboxProps, SuggestionList, useSuggestionList } from './suggestionList';

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
    const inputRef = useRef<HTMLInputElement>(null);

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

    const addHashtag = (suggestion: Suggestion) => {
        if (!hashtags.includes(suggestion.name)) {
            setHashtags([...hashtags, suggestion.name]);
        }

        setQuery('');
        // Return the caret to the input so the next hashtag can be typed right
        // away, whether this one was picked with the mouse or with Enter.
        inputRef.current?.focus();
    };

    const removeHashtag = (name: string) => {
        setHashtags(hashtags.filter((hashtagName) => hashtagName !== name));
    };

    const list = useSuggestionList({
        items: suggestions,
        onCommit: addHashtag,
        isAvailable: isFocused,
    });

    return (
        <div className="photo-tagging-hashtag-input">
            <div className="photo-tagging-hashtag-input-field">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Add hashtag..."
                    value={query}
                    {...comboboxProps(list)}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={list.handleKeyDown}
                />
                <SuggestionList
                    list={list}
                    items={suggestions}
                    className="photo-tagging-suggestions-dropdown"
                    getKey={(suggestion) => `${suggestion.kind}:${suggestion.name}`}
                    getLabel={(suggestion) =>
                        suggestion.kind === 'create'
                            ? `Create «${suggestion.name}»`
                            : `#${suggestion.name}`
                    }
                    getItemClassName={(suggestion) =>
                        suggestion.kind === 'create' ? 'photo-tagging-suggestion-create' : ''
                    }
                    preserveFocus
                />
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
