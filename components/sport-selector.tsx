'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { SportType } from '@/types';

const SPORTS: { id: SportType; label: string }[] = [
    { id: 'baseball', label: 'Baseball' },
    { id: 'softball', label: 'Softball' },
    { id: 'mens-basketball', label: 'MBB' },
    { id: 'womens-basketball', label: 'WBB' },
    { id: 'mens-soccer', label: 'MSOC' },
    { id: 'womens-soccer', label: 'WSOC' },
    { id: 'football', label: 'Football' },
    { id: 'womens-volleyball', label: 'WVBALL' },
];

interface SportSelectorProps {
    value: SportType;
    onChange: (sport: SportType) => void;
}

/**
 * Sport selection button grid
 */
export function SportSelector({ value, onChange }: SportSelectorProps) {
    return (
        <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Sport</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {SPORTS.map((sport) => (
                    <Button
                        key={sport.id}
                        variant={value === sport.id ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => onChange(sport.id)}
                    >
                        {sport.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}

export { SPORTS };
