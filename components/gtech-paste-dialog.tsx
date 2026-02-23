'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardPaste, ExternalLink, Check, Loader2, Eye, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SportType } from '@/types';

interface GtechPasteDialogProps {
    sport: SportType;
    pastedStats: string;
    onStatsChange: (text: string) => void;
}

/** Quick client-side check that the pasted text looks like GT stats. */
function validatePastedStats(text: string): {
    valid: boolean;
    hasBatting: boolean;
    hasPitching: boolean;
    message: string;
} {
    const lines = text.split('\n');

    // Look for batting header (PLAYER AVG GP-GS AB ...)
    const hasBatting = lines.some(
        (l) => l.includes('PLAYER') && l.includes('AVG') && l.includes('AB')
    );

    // Look for pitching header (PLAYER ERA W-L APP ...)
    const hasPitching = lines.some(
        (l) => l.includes('PLAYER') && l.includes('ERA') && l.includes('IP')
    );

    if (hasBatting && hasPitching) {
        return {
            valid: true,
            hasBatting: true,
            hasPitching: true,
            message: 'Stats found',
        };
    }

    if (hasBatting) {
        return {
            valid: true,
            hasBatting: true,
            hasPitching: false,
            message: 'Batting found (pitching missing — make sure you copied the entire PDF)',
        };
    }

    if (hasPitching) {
        return {
            valid: true,
            hasBatting: false,
            hasPitching: true,
            message: 'Pitching found (batting missing — make sure you copied the entire PDF)',
        };
    }

    return {
        valid: false,
        hasBatting: false,
        hasPitching: false,
        message:
            'This doesn\'t look like GT stats. Open the stats PDF, click on the PDF, press Ctrl+A to select all, then Ctrl+C to copy.',
    };
}

/**
 * Inline section for GT stats pasting.
 *
 * Shows instructions + "Open Stats PDF" link + "Paste from Clipboard" button.
 * Validates the pasted text and shows a success/error message.
 * Optional Eye icon to preview pasted text in a read-only dialog.
 */
export function GtechPasteDialog({
    sport,
    pastedStats,
    onStatsChange,
}: GtechPasteDialogProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfUrlLoading, setPdfUrlLoading] = useState(false);
    const [isPasting, setIsPasting] = useState(false);

    const hasStats = pastedStats.trim().length > 0;
    const validation = hasStats ? validatePastedStats(pastedStats) : null;

    // Fetch the current PDF URL when the component mounts or sport changes
    const fetchPdfUrl = useCallback(async () => {
        setPdfUrlLoading(true);
        try {
            const res = await fetch('/api/gtech-pdf-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sport }),
            });
            const json = await res.json();
            if (json.success && json.pdfUrl) {
                setPdfUrl(json.pdfUrl);
            } else {
                setPdfUrl(null);
            }
        } catch {
            setPdfUrl(null);
        } finally {
            setPdfUrlLoading(false);
        }
    }, [sport]);

    useEffect(() => {
        fetchPdfUrl();
    }, [fetchPdfUrl]);

    const handlePasteFromClipboard = async () => {
        setIsPasting(true);
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                toast.error('Clipboard is empty. Copy the PDF text first.');
                return;
            }

            const result = validatePastedStats(text);
            if (!result.valid) {
                toast.error(result.message, { duration: 6000 });
                return;
            }

            onStatsChange(text);

            if (result.hasBatting && result.hasPitching) {
                toast.success('Stats pasted — batting + pitching found');
            } else {
                toast.warning(result.message, { duration: 5000 });
            }
        } catch {
            toast.error(
                'Could not read clipboard. Make sure you\'ve copied the PDF text and allowed clipboard access.'
            );
        } finally {
            setIsPasting(false);
        }
    };

    return (
        <div className="space-y-3 rounded-md border border-border p-4 bg-muted/30">
            {/* Instructions */}
            <p className="text-sm text-muted-foreground">
                GT stats require a manual paste.{' '}
                {pdfUrlLoading ? (
                    <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Finding PDF…
                    </span>
                ) : pdfUrl ? (
                    <>
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                            Open the Stats PDF
                            <ExternalLink className="h-3 w-3" />
                        </a>
                        , click on the PDF, press{' '}
                        <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
                            Ctrl+A
                        </kbd>{' '}
                        to select everything, then{' '}
                        <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
                            Ctrl+C
                        </kbd>{' '} or right click & select copy to copy the entire PDF. Then press the Paste button below.
                    </>
                ) : (
                    'Open the GT stats PDF, click on it, press Ctrl+A to select everything, then Ctrl+C to copy the entire PDF.'
                )}
            </p>

            {/* Paste Button + Status */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handlePasteFromClipboard}
                    disabled={isPasting}
                >
                    {isPasting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <ClipboardPaste className="h-3.5 w-3.5" />
                    )}
                    Paste from Clipboard
                </Button>

                {hasStats && validation && (
                    <>
                        {validation.valid ? (
                            <Badge
                                variant="outline"
                                className="gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
                            >
                                <Check className="h-3 w-3" />
                                {validation.message}
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="gap-1 text-destructive border-destructive/30"
                            >
                                <AlertCircle className="h-3 w-3" />
                                Invalid paste
                            </Badge>
                        )}

                        {/* View pasted text — icon-only button */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    title="View pasted text"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl max-h-[80vh]">
                                <DialogHeader>
                                    <DialogTitle>Pasted Stats Preview</DialogTitle>
                                    <DialogDescription>
                                        Raw text that was pasted from the clipboard. Use this to verify the paste looks correct.
                                    </DialogDescription>
                                </DialogHeader>
                                <pre className="overflow-auto max-h-[60vh] rounded-md border border-input bg-background p-3 text-xs font-mono whitespace-pre">
                                    {pastedStats}
                                </pre>
                            </DialogContent>
                        </Dialog>
                    </>
                )}
            </div>
        </div>
    );
}
