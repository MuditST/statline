import type { SportType } from '@/types';

/**
 * Represents a school saved to localStorage with custom URLs
 */
export interface SavedSchool {
    /** URL-safe identifier, e.g., "georgia-state" */
    id: string;
    /** Display name, e.g., "Georgia State" */
    name: string;
    /** Which sport this is saved for */
    sport: SportType;
    /** Custom roster URL */
    rosterUrl: string;
    /** Custom stats PDF URL (Sidearm) or stats page URL (WMT) */
    statsUrl: string;
    /** Platform type - 'wmt' for WMT schools, undefined for Sidearm (default) */
    platform?: 'wmt';
    /** Timestamp when saved */
    savedAt: number;
}

const STORAGE_KEY = 'statline:saved-schools';

/**
 * Convert a name to a URL-safe slug ID
 * e.g., "Georgia State" -> "georgia-state"
 */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')      // Replace spaces with dashes
        .replace(/-+/g, '-');      // Replace multiple dashes with single
}

/**
 * Get all saved schools from localStorage
 */
function getAllSavedSchools(): SavedSchool[] {
    if (typeof window === 'undefined') return [];

    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data) as SavedSchool[];
    } catch {
        return [];
    }
}

/**
 * Save all schools to localStorage
 */
function setAllSavedSchools(schools: SavedSchool[]): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schools));
    } catch (error) {
        console.error('Failed to save schools to localStorage:', error);
    }
}

/**
 * Get all saved schools for a specific sport
 */
export function getSavedSchools(sport: SportType): SavedSchool[] {
    return getAllSavedSchools().filter(school => school.sport === sport);
}

/**
 * Get a specific saved school by ID and sport
 */
export function getSavedSchool(id: string, sport: SportType): SavedSchool | null {
    const schools = getAllSavedSchools();
    return schools.find(s => s.id === id && s.sport === sport) || null;
}

/**
 * Check if a school has a custom override for a sport
 */
export function hasCustomOverride(id: string, sport: SportType): boolean {
    return getSavedSchool(id, sport) !== null;
}

/**
 * Save or update a school in localStorage
 * If a school with the same ID and sport exists, it will be overwritten
 */
export function saveSchool(school: Omit<SavedSchool, 'id' | 'savedAt'> & { name: string }): SavedSchool {
    const id = slugify(school.name);
    const savedSchool: SavedSchool = {
        ...school,
        id,
        savedAt: Date.now(),
    };

    const schools = getAllSavedSchools();

    // Find existing school with same ID and sport
    const existingIndex = schools.findIndex(
        s => s.id === id && s.sport === school.sport
    );

    if (existingIndex >= 0) {
        // Update existing
        schools[existingIndex] = savedSchool;
    } else {
        // Add new
        schools.push(savedSchool);
    }

    setAllSavedSchools(schools);
    return savedSchool;
}

/**
 * Delete a saved school by ID and sport
 * Returns true if something was deleted, false otherwise
 */
export function deleteSchool(id: string, sport: SportType): boolean {
    const schools = getAllSavedSchools();
    const filtered = schools.filter(s => !(s.id === id && s.sport === sport));

    if (filtered.length === schools.length) {
        return false; // Nothing was deleted
    }

    setAllSavedSchools(filtered);
    return true;
}

/**
 * Get all unique school IDs that have custom overrides (across all sports)
 */
export function getCustomSchoolIds(): Set<string> {
    const schools = getAllSavedSchools();
    return new Set(schools.map(s => s.id));
}
