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
import { validateHybridPastedStats } from '@/lib/parsers/hybrid-parser';

interface StatsPasteDialogProps {
    sport: SportType;
    pastedStats: string;
    onStatsChange: (text: string) => void;
    /** If true, show GT-specific PDF URL link. Default false. */
    showGtechPdfLink?: boolean;
}

/**
 * Inline section for pasting stats text.
 *
 * Shows instructions + "Paste from Clipboard" button.
 * Validates the pasted text and shows a success/error message.
 * Optional Eye icon to preview pasted text in a read-only dialog.
 *
 * Used by:
 * - GT configured school (showGtechPdfLink=true → shows "Open Stats PDF" link)
 * - Hybrid configured school (showGtechPdfLink=false → generic paste instructions)
 * - Custom URL form with hybrid tab (showGtechPdfLink=false)
 */
export function StatsPasteDialog({
    sport,
    pastedStats,
    onStatsChange,
    showGtechPdfLink = false,
}: StatsPasteDialogProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfUrlLoading, setPdfUrlLoading] = useState(false);
    const [isPasting, setIsPasting] = useState(false);

    const hasStats = pastedStats.trim().length > 0;
    const validation = hasStats ? validateHybridPastedStats(pastedStats) : null;

    // Fetch the current PDF URL when GT mode — only when showGtechPdfLink is true
    const fetchPdfUrl = useCallback(async () => {
        if (!showGtechPdfLink) return;
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
    }, [sport, showGtechPdfLink]);

    useEffect(() => {
        fetchPdfUrl();
    }, [fetchPdfUrl]);

    const handlePasteFromClipboard = async () => {
        setIsPasting(true);
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                toast.error('Clipboard is empty — copy the stats page first.');
                return;
            }

            const result = validateHybridPastedStats(text);
            if (!result.valid) {
                toast.error('No stats headers detected — make sure you copied the full stats page.', { duration: 6000 });
                return;
            }

            onStatsChange(text);

            if (result.hasBatting && result.hasPitching) {
                toast.success('Stats pasted successfully');
            } else {
                toast.warning('Incomplete stats — only ' + (result.hasBatting ? 'batting' : 'pitching') + ' detected', { duration: 5000 });
            }
        } catch {
            toast.error('Could not read clipboard — allow clipboard access and try again.');
        } finally {
            setIsPasting(false);
        }
    };

    return (
        <div className="space-y-3 rounded-md border border-border p-4 bg-muted/30">
            {/* Instructions */}
            <p className="text-sm text-muted-foreground">
                {showGtechPdfLink ? (
                    // GT-specific instructions with PDF link
                    <>
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
                                </kbd>{' '} or right click &amp; select copy to copy the entire PDF. Then press the Paste button below.
                            </>
                        ) : (
                            'Open the GT stats PDF, click on it, press Ctrl+A to select everything, then Ctrl+C to copy the entire PDF.'
                        )}
                    </>
                ) : (
                    // Generic hybrid instructions
                    <>
                        Open the team&apos;s stats PDF or stats page, select all text (
                        <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
                            Ctrl+A
                        </kbd>
                        ), copy (
                        <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
                            Ctrl+C
                        </kbd>
                        ), then press the Paste button below.
                    </>
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

// Re-export old name for backwards compatibility (GT uses still import this)
export { StatsPasteDialog as GtechPasteDialog };
