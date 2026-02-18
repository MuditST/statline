'use client';

import * as React from 'react';
import { Info, Pencil, Trash2, ExternalLink, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SchoolInfoPopoverProps {
    schoolName: string;
    rosterUrl: string;
    statsUrl: string;
    isCustomized: boolean;
    platform?: 'gtech' | 'wmt';
    onEdit: () => void;
    onDelete?: () => void;
    disabled?: boolean;
}

export function SchoolInfoPopover({
    schoolName,
    rosterUrl,
    statsUrl,
    isCustomized,
    platform,
    onEdit,
    onDelete,
    disabled = false,
}: SchoolInfoPopoverProps) {
    const [open, setOpen] = React.useState(false);

    const handleEdit = () => {
        setOpen(false);
        onEdit();
    };

    const handleDelete = () => {
        setOpen(false);
        onDelete?.();
    };

    // Truncate long URLs for display
    const truncateUrl = (url: string, maxLength: number = 50) => {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    };

    return (
        <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="View school info"
                    disabled={disabled}
                >
                    <Info className={`h-4 w-4 ${disabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">Data Sources</h4>
                        <div className="flex items-center gap-1.5">
                            {platform === 'wmt' && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    WMT API
                                </Badge>
                            )}
                            {platform === 'gtech' && (
                                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    GT Hybrid
                                </Badge>
                            )}
                            {isCustomized ? (
                                <Badge variant="secondary" className="text-xs">
                                    Custom
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-xs">
                                    Config
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* URLs */}
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                                Roster URL
                            </p>
                            <a
                                href={rosterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                            >
                                {truncateUrl(rosterUrl)}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                                Stats {platform === 'wmt' ? 'API' : 'URL'}
                            </p>
                            <a
                                href={statsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                            >
                                {truncateUrl(statsUrl)}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                        </div>
                    </div>

                    {/* Note for Sidearm config schools about fallback */}
                    {!isCustomized && !platform && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>Config URLs try current year first, then fall back to previous year if not found.</span>
                        </div>
                    )}

                    <Separator />

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEdit}
                            className="flex-1"
                        >
                            <Pencil className="h-3 w-3 mr-1.5" />
                            Edit
                        </Button>

                        {isCustomized && onDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3 w-3 mr-1.5" />
                                        Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Remove custom URLs?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will remove the custom URLs for {schoolName}.
                                            {' '}If this school exists in the default config, it will
                                            revert to using config URLs.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete}>
                                            Remove
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
