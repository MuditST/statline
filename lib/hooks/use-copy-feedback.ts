'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Hook for clipboard copy with visual feedback.
 *
 * Returns `{ copied, copiedType, copyWithFeedback }`.
 *
 * Call `copyWithFeedback(text, label)` to write `text` to the clipboard
 * and show a 2-second "Copied!" state identified by `label`.
 *
 * @example
 * const { copied, copiedType, copyWithFeedback } = useCopyFeedback();
 * <Button onClick={() => copyWithFeedback(rowText, 'Roster')}>
 *     {copied && copiedType === 'Roster' ? 'Copied!' : 'Roster'}
 * </Button>
 */
export function useCopyFeedback(durationMs = 2000) {
    const [copied, setCopied] = useState(false);
    const [copiedType, setCopiedType] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const copyWithFeedback = useCallback(async (text: string, label: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setCopiedType(label);

        // Clear any existing timer so rapid clicks don't leave stale state
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setCopied(false);
            setCopiedType('');
        }, durationMs);
    }, [durationMs]);

    return { copied, copiedType, copyWithFeedback } as const;
}
