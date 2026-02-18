'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface StatsTableSkeletonProps {
    /** Number of skeleton rows to display */
    rows?: number;
}

/**
 * Reusable skeleton loader for stats tables.
 * Use this inside table containers while data is loading.
 */
export function StatsTableSkeleton({ rows = 12 }: StatsTableSkeletonProps) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
            ))}
        </div>
    );
}
