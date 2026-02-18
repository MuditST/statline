/**
 * Georgia Tech PDF stats parser
 * 
 * GT uses a unique stats PDF format (not Sidearm). Unlike Sidearm PDFs where
 * each column value is a separate text item, GT's PDF merges multiple column
 * values into single text items when they're adjacent digits.
 *
 * Strategy:
 * 1. Extract text items with disableCombineTextItems=true
 * 2. Group into rows by Y position
 * 3. Tokenize each row by detecting X-gaps between items (gap > 5px = new token)
 * 4. Map tokens to stat groups by X-position ranges
 * 5. Split merged groups using baseball formula constraints:
 *    - H ≤ AB, 2B ≤ H, 3B ≤ H, HR ≤ H, 2B+3B+HR ≤ H
 *    - XB = 2B + 3B + HR
 *    - TB = H + 2B + 2*3B + 3*HR
 *    - ER ≤ R (pitching)
 *
 * This is GT-specific — do NOT use for any Sidearm schools.
 */
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { RosterPlayer } from '@/lib/roster/extractor';
import type { PlayerStats } from '@/lib/parsers/baseball';

interface TextItem {
    str: string;
    x: number;
    y: number;
    width: number;
}

// The GAP_THRESHOLD (in PDF units) determines when consecutive text items
// are considered separate tokens. GT PDFs have ~11-15px gaps between columns
// and ~0px within merged items.
const GAP_THRESHOLD = 5;

// ===== Data structures =====

interface GtechBattingRaw {
    name: string;
    ab: number; r: number; h: number;
    doubles: number; triples: number; hr: number;
    rbi: number; bb: number; hbp: number; so: number;
    gdp: number; sf: number; sh: number;
    sb: number; att: number;
}

interface GtechPitchingRaw {
    name: string;
    w: number; l: number; app: number; gs: number;
    cg: number; sho: string; sv: number;
    ip: string; h: number; r: number; er: number;
    bb: number; so: number; hr: number; hbp: number;
}

/**
 * Tokenize a row of text items by detecting X-gaps.
 * Returns an array of tokens, each with combined text and starting X position.
 *
 * @param colBreaks - X positions where tokens must break regardless of gap size.
 *   Prevents items from different columns merging into one token.
 */
function tokenizeRow(items: TextItem[], colBreaks: number[] = []): { text: string; x: number }[] {
    if (items.length === 0) return [];

    const tokens: { text: string; x: number }[] = [];
    let currentText = items[0].str;
    let currentX = items[0].x;
    let prevEnd = items[0].x + items[0].width;

    for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - prevEnd;
        // Break on gap OR when items straddle a column boundary
        const crossesBoundary = colBreaks.some(b => currentX < b && items[i].x >= b);
        if (gap > GAP_THRESHOLD || crossesBoundary) {
            tokens.push({ text: currentText, x: currentX });
            currentText = items[i].str;
            currentX = items[i].x;
        } else {
            currentText += items[i].str;
        }
        prevEnd = items[i].x + items[i].width;
    }
    tokens.push({ text: currentText, x: currentX });

    return tokens;
}

/**
 * Split a string of concatenated digits into R+H+2B+3B+HR, with optional XB suffix.
 * 
 * The GT PDF sometimes merges R+H+2B+3B+HR+XB into one token, where XB = 2B+3B+HR.
 * We try 6 values first (with XB verification), then fall back to 5 values.
 * Uses constraint: H ≤ maxAB, 2B+3B+HR ≤ H.
 */
function splitRH2B3BHR(merged: string, ab: number): [number, number, number, number, number] | null {
    if (merged.length < 4) return null;

    const maxAB = Math.max(ab, 100); // Pinch runners: AB=0 but R can be > 0
    const maxH = ab > 0 ? ab : 50; // H ≤ AB when AB > 0, otherwise allow up to 50

    // Try 6-value split first: R+H+2B+3B+HR+XB where XB = 2B+3B+HR
    if (merged.length >= 6) {
        const results6: [number, number, number, number, number][] = [];

        for (let r_len = 1; r_len <= 2 && r_len < merged.length - 4; r_len++) {
            const r = parseInt(merged.substring(0, r_len));
            if (r > maxAB) continue;

            for (let h_len = 1; h_len <= 2 && r_len + h_len < merged.length - 3; h_len++) {
                const h = parseInt(merged.substring(r_len, r_len + h_len));
                if (h > maxH) continue;

                const rest = merged.substring(r_len + h_len);

                for (let d2_len = 1; d2_len <= 2 && d2_len < rest.length - 2; d2_len++) {
                    const d2 = parseInt(rest.substring(0, d2_len));
                    if (d2 > h) continue;

                    for (let d3_len = 1; d3_len <= 2 && d2_len + d3_len < rest.length - 1; d3_len++) {
                        const d3 = parseInt(rest.substring(d2_len, d2_len + d3_len));
                        if (d3 > h) continue;

                        // Try splitting remaining into HR + XB
                        const hrXbStr = rest.substring(d2_len + d3_len);
                        for (let hr_len = 1; hr_len <= 2 && hr_len < hrXbStr.length; hr_len++) {
                            const hr = parseInt(hrXbStr.substring(0, hr_len));
                            if (hr > h) continue;
                            if (d2 + d3 + hr > h) continue;

                            const xbStr = hrXbStr.substring(hr_len);
                            if (xbStr.length === 0 || xbStr.length > 2) continue;
                            const xb = parseInt(xbStr);

                            // XB must equal 2B + 3B + HR
                            if (xb === d2 + d3 + hr) {
                                results6.push([r, h, d2, d3, hr]);
                            }
                        }
                    }
                }
            }
        }

        if (results6.length === 1) return results6[0];
        if (results6.length > 1) {
            // Prefer highest H (most realistic)
            results6.sort((a, b) => b[1] - a[1]);
            return results6[0];
        }
    }

    // Fall back to 5-value split: R+H+2B+3B+HR (no XB suffix)
    if (merged.length < 5) return null;

    const results: [number, number, number, number, number][] = [];

    for (let r_len = 1; r_len <= 2 && r_len < merged.length - 3; r_len++) {
        const r = parseInt(merged.substring(0, r_len));
        if (r > maxAB) continue;

        for (let h_len = 1; h_len <= 2 && r_len + h_len < merged.length - 2; h_len++) {
            const h = parseInt(merged.substring(r_len, r_len + h_len));
            if (h > maxH) continue;

            const rest = merged.substring(r_len + h_len);

            for (let d2_len = 1; d2_len <= 2 && d2_len < rest.length - 1; d2_len++) {
                const d2 = parseInt(rest.substring(0, d2_len));
                if (d2 > h) continue;

                for (let d3_len = 1; d3_len <= 2 && d2_len + d3_len < rest.length; d3_len++) {
                    const d3 = parseInt(rest.substring(d2_len, d2_len + d3_len));
                    if (d3 > h) continue;

                    const hrStr = rest.substring(d2_len + d3_len);
                    if (hrStr.length === 0 || hrStr.length > 2) continue;
                    const hr = parseInt(hrStr);
                    if (hr > h) continue;
                    if (d2 + d3 + hr > h) continue;

                    results.push([r, h, d2, d3, hr]);
                }
            }
        }
    }

    if (results.length === 1) return results[0];
    if (results.length === 0) return null;
    // Prefer highest H (most realistic)
    results.sort((a, b) => b[1] - a[1]);
    return results[0];
}

/**
 * Extract RBI from RBI+TB merged string, using known TB.
 * e.g. "510" with knownTB=10 → RBI=5; "81012" with knownTB=12 → RBI=8 (remaining "10" is TB=10... hmm)
 * Strategy: Strip known TB suffix from the end, remainder is RBI.
 */
function extractRBIFromMerged(numPart: string, knownTB: number): number {
    if (!numPart) return 0;

    const tbStr = String(knownTB);

    // If numPart ends with TB, strip it to get RBI
    if (numPart.endsWith(tbStr) && numPart.length > tbStr.length) {
        return parseInt(numPart.substring(0, numPart.length - tbStr.length)) || 0;
    }

    // If the whole string is just RBI (TB was a separate token or not present)
    return parseInt(numPart) || 0;
}

/**
 * Split merged IP+H+R+ER+BB+K pitching string.
 * IP always contains a '.', use it as anchor.
 * ER ≤ R is the key constraint.
 */
function splitPitchingMerged(merged: string): {
    ip: string; h: number; r: number; er: number; bb: number; k: number
} | null {
    const dotIdx = merged.indexOf('.');
    if (dotIdx < 0) return null;

    // IP = digits up to dot + 1 digit (e.g., "29.1", "4.2", "15.0")
    const ipEnd = dotIdx + 2;
    if (ipEnd > merged.length) return null;

    const ip = merged.substring(0, ipEnd);
    const rest = merged.substring(ipEnd);

    if (!rest || rest.length < 5) {
        // Might be just IP + H merged (e.g., "13.217" → IP=13.2, H=17)
        if (rest && rest.length >= 1) {
            return { ip, h: parseInt(rest) || 0, r: 0, er: 0, bb: 0, k: 0 };
        }
        return { ip, h: 0, r: 0, er: 0, bb: 0, k: 0 };
    }

    // rest = H + R + ER + BB + K (each 1-2 digits)
    const results: { h: number; r: number; er: number; bb: number; k: number }[] = [];

    for (let h_len = 1; h_len <= 2 && h_len < rest.length - 3; h_len++) {
        const h = parseInt(rest.substring(0, h_len));
        const r1 = rest.substring(h_len);

        for (let r_len = 1; r_len <= 2 && r_len < r1.length - 2; r_len++) {
            const r = parseInt(r1.substring(0, r_len));
            const r2 = r1.substring(r_len);

            for (let er_len = 1; er_len <= 2 && er_len < r2.length - 1; er_len++) {
                const er = parseInt(r2.substring(0, er_len));
                if (er > r) continue; // ER ≤ R
                const r3 = r2.substring(er_len);

                for (let bb_len = 1; bb_len <= 2 && bb_len < r3.length; bb_len++) {
                    const bb = parseInt(r3.substring(0, bb_len));
                    const kStr = r3.substring(bb_len);
                    if (kStr.length === 0 || kStr.length > 2) continue;
                    const k = parseInt(kStr);

                    results.push({ h, r, er, bb, k });
                }
            }
        }
    }

    if (results.length === 1) return { ip, ...results[0] };
    if (results.length === 0) return null;
    // Prefer solution where ER is closest to R
    results.sort((a, b) => Math.abs(a.er - a.r) - Math.abs(b.er - b.r));
    return { ip, ...results[0] };
}

/**
 * Parse batting tokens into a batting stats record.
 * Tokens are mapped to stat groups by X-position ranges.
 */
function parseBattingTokens(tokens: { text: string; x: number }[]): GtechBattingRaw | null {
    const nameTokens = tokens.filter(t => t.x < 120);
    const dataTokens = tokens.filter(t => t.x >= 120).sort((a, b) => a.x - b.x);

    if (nameTokens.length === 0) return null;
    const playerName = nameTokens.map(t => t.text).join('').replace(/\s*,\s*/, ', ').replace(/\s+/g, ' ').trim();
    if (!playerName.includes(',')) return null;

    // ========================================
    // Extract stat groups from tokens by X range
    // Based on exact X positions from gap analysis (Feb 2026 PDF):
    //
    // AVG:    x ∈ [120, 155)   e.g., ".778"@134.7
    // GP-GS:  x ∈ [155, 190)   e.g., "3-2"@166.9
    // AB:     x ∈ [190, 210)   e.g., "9"@194.5
    // RH_REGION: x ∈ [210, 295)  merged R+H+2B+3B+HR+XB (one or more tokens)
    // RBI_TB_REGION: x ∈ [295, 355) merged RBI+TB+SLG
    // BB:     x ∈ [355, 376)   e.g., "4"@364.2 or "30"@364.4 (BB+HP merged)
    // HP:     x ∈ [376, 394)   e.g., "1"@381.3
    // K:      x ∈ [394, 414)   e.g., "1"@397.6
    // GDP:    x ∈ [414, 432)   (or merged with OB%)
    // OB%:    x ∈ [432, 458)   e.g., ".857"@434.8 (skip)
    // SF:     x ∈ [458, 472)   e.g., "00"@460.9 (SF+SH merged)
    // SH:     x ∈ [472, 494)   (separate SH if present)
    // SB-ATT: x ∈ [494, 525)   e.g., "0-0"@501.9
    // PO+A+E: x ∈ [525, 570)
    // FLD%:   x ∈ [570+)    
    // ========================================

    let ab = 0;
    let mergedRH = '';     // concatenated R+H+2B+3B+HR+XB tokens
    let mergedRBITB = '';  // concatenated RBI+TB+SLG tokens
    let bb = 0, hbp = 0, so = 0, gdp = 0, sf = 0, sh = 0;
    let sb_att = '';
    let hasHPToken = false;

    for (const token of dataTokens) {
        const t = token.text.trim();
        if (!t) continue;
        const x = token.x;

        if (x >= 190 && x < 210) {
            ab = parseInt(t) || 0;
        } else if (x >= 210 && x < 295) {
            mergedRH += t;
        } else if (x >= 295 && x < 355) {
            mergedRBITB += t;
        } else if (x >= 355 && x < 376) {
            // BB or BB+HP merged
            bb = parseInt(t) || 0;
        } else if (x >= 376 && x < 392) {
            hbp = parseInt(t) || 0;
            hasHPToken = true;
        } else if (x >= 394 && x < 414) {
            so = parseInt(t) || 0;
        } else if (x >= 414 && x < 458) {
            // Could be GDP or OB% — OB% contains '.'
            if (!t.includes('.')) {
                gdp = parseInt(t) || 0;
            }
        } else if (x >= 458 && x < 472) {
            // SF or SF+SH merged
            const num = parseInt(t) || 0;
            if (t.length >= 2) {
                sf = parseInt(t[0]) || 0;
                sh = parseInt(t.substring(1)) || 0;
            } else {
                sf = num;
            }
        } else if (x >= 472 && x < 494) {
            sh = parseInt(t) || 0;
        } else if (x >= 494 && x < 525) {
            if (t.includes('-')) sb_att = t;
        }
    }

    // Fix BB+HP merge: If no separate HP token was found and BB is multi-digit,
    // the last digit might be HP (usually 0 when merged).
    if (!hasHPToken && String(bb).length >= 2) {
        const bbStr = String(bb);
        hbp = parseInt(bbStr[bbStr.length - 1]) || 0;
        bb = parseInt(bbStr.substring(0, bbStr.length - 1)) || 0;
    }

    // Split R+H+2B+3B+HR
    let r = 0, h = 0, doubles = 0, triples = 0, hr = 0;

    if (mergedRH.length >= 5) {
        const split = splitRH2B3BHR(mergedRH, ab);
        if (split) {
            [r, h, doubles, triples, hr] = split;
        }
    } else if (mergedRH.length === 4) {
        // Could be R(1)+H(1)+2B(1)+3B(1) or similar 4-digit combo
        // Try constraint solver
        const split = splitRH2B3BHR(mergedRH, ab);
        if (split) {
            [r, h, doubles, triples, hr] = split;
        } else {
            // Fallback: assume R is first char, rest is H+extras
            r = parseInt(mergedRH[0]) || 0;
        }
    } else if (mergedRH.length > 0) {
        // Very short — probably just R or R+H separate
        r = parseInt(mergedRH) || 0;
    }

    // Compute known TB for RBI extraction: TB = H + 2B + 2*3B + 3*HR
    const knownTB = h + doubles + (2 * triples) + (3 * hr);

    // Extract RBI from RBI+TB+SLG merged string
    let rbi = 0;
    if (mergedRBITB) {
        // Remove SLG (starts with '.')
        // Remove SLG pattern (format: .NNN or N.NNN, e.g. ".636" or "1.111")
        const slgMatch = mergedRBITB.match(/^(.*?)(\d?\.\d{3})$/);
        const numPart = slgMatch ? slgMatch[1] : mergedRBITB;
        rbi = extractRBIFromMerged(numPart, knownTB);
    }

    // Parse SB-ATT — pdf-parse may merge PO digits into the same text item
    // (e.g. "0-016" = SB-ATT 0-0, PO 16). SB and ATT have the same digit count
    // (both single-digit or both double-digit), so ATT takes at most len(SB) + 1 digits.
    let sb = 0, att = 0;
    const dashIdx = sb_att.indexOf('-');
    if (dashIdx > 0) {
        sb = parseInt(sb_att.substring(0, dashIdx)) || 0;
        const sbDigits = dashIdx; // number of digits in SB
        const afterDash = sb_att.substring(dashIdx + 1);
        // ATT has at most sbDigits+1 digits (e.g. SB=9 → ATT could be up to 2 digits)
        const maxAttLen = Math.min(sbDigits + 1, afterDash.length);
        // Try shortest ATT first (same length as SB), then one longer
        for (let len = sbDigits; len <= maxAttLen; len++) {
            const candidate = parseInt(afterDash.substring(0, len));
            if (candidate >= sb) { att = candidate; break; }
        }
    }

    return {
        name: playerName, ab, r, h, doubles, triples, hr,
        rbi, bb, hbp, so, gdp, sf, sh, sb, att,
    };
}

/**
 * Parse pitching tokens into a pitching stats record.
 */
function parsePitchingTokens(tokens: { text: string; x: number }[]): GtechPitchingRaw | null {
    const nameTokens = tokens.filter(t => t.x < 120);
    const dataTokens = tokens.filter(t => t.x >= 120).sort((a, b) => a.x - b.x);

    if (nameTokens.length === 0) return null;
    const playerName = nameTokens.map(t => t.text).join('').replace(/\s*,\s*/, ', ').replace(/\s+/g, ' ').trim();
    if (!playerName.includes(',')) return null;

    // ========================================
    // Pitching X ranges (from gap analysis):
    //
    // ERA:   x ∈ [120, 152)   e.g., "3.070-0"@131.1 (ERA+W-L) or "4.04"@130.3
    // W-L:   x ∈ [152, 180)   e.g., "2-1"@157.0
    // APP:   x ∈ [180, 198)   e.g., "5"@185.1
    // GS:    x ∈ [198, 215)   e.g., "2"@201.8
    // CG:    x ∈ [215, 238)   e.g., "0"@219.1
    // SHO:   x ∈ [238, 255)   e.g., "0"@242.2
    // SV:    x ∈ [255, 275)   e.g., "0"@259.1
    // IP_MEGA: x ∈ [275, 355) IP+possibly H+R+ER+BB+K merged
    // BB_PIT:  x ∈ [355, 373) (only if IP_MEGA didn't eat them)
    // K_PIT:   x ∈ [373, 393)
    // WHIP: x ∈ [393, 420)
    // 2B_PIT: x ∈ [420, 437)
    // 3B_PIT: x ∈ [437, 455)
    // HR_PIT: x ∈ [455, 470)
    // B_AVG: x ∈ [470, 502)
    // WP: x ∈ [502, 518)
    // HP_PIT: x ∈ [518, 535)
    // BK: x ∈ [535, 556)
    // ========================================

    let era = '', wl = '';
    let app = 0, gs = 0, cg = 0, sho = '0', sv = 0;
    let mergedIP = ''; // IP + possibly H+R+ER+BB+K
    let mergedBBK = ''; // BB+K if merged after IP
    let bb = 0, so = 0, h_pitch = 0, r_pitch = 0, er = 0;
    let hr = 0, hbp = 0;
    let hasSeparateH = false, hasSeparateR = false, hasSeparateER = false;
    let hasSeparateBB = false, hasSeparateK = false;

    for (const token of dataTokens) {
        const t = token.text.trim();
        if (!t) continue;
        const x = token.x;

        if (x >= 120 && x < 152) {
            // ERA — might include W-L merged
            era = t;
        } else if (x >= 152 && x < 180) {
            wl = t;
        } else if (x >= 180 && x < 198) {
            app = parseInt(t) || 0;
        } else if (x >= 198 && x < 215) {
            gs = parseInt(t) || 0;
        } else if (x >= 215 && x < 238) {
            cg = parseInt(t) || 0;
        } else if (x >= 238 && x < 255) {
            sho = t;
        } else if (x >= 255 && x < 275) {
            sv = parseInt(t) || 0;
        } else if (x >= 275 && x < 355) {
            // IP region — might contain IP+H+R+ER+BB+K
            mergedIP += t;
        } else if (x >= 355 && x < 373) {
            bb = parseInt(t) || 0;
            hasSeparateBB = true;
        } else if (x >= 373 && x < 393) {
            so = parseInt(t) || 0;
            hasSeparateK = true;
        } else if (x >= 455 && x < 470) {
            hr = parseInt(t) || 0;
        } else if (x >= 518 && x < 540) {
            hbp = parseInt(t) || 0;
        }
    }

    // Parse ERA + W-L merge
    if (era.includes('-') && !wl) {
        // "4.062-3" or "3.070-0" or "31.480-0"
        const m = era.match(/^(\d+\.\d{2})(\d+-\d+)$/);
        if (m) {
            era = m[1];
            wl = m[2];
        } else {
            // Try "4.042-1" pattern: ERA=4.04, W-L=2-1
            const m2 = era.match(/^(\d+\.\d{2})(\d+-\d+)/);
            if (m2) {
                era = m2[1];
                wl = m2[2];
            }
        }
    }

    let w = 0, l = 0;
    const wlMatch = wl.match(/(\d+)-(\d+)/);
    if (wlMatch) {
        w = parseInt(wlMatch[1]);
        l = parseInt(wlMatch[2]);
    }

    // Parse IP region
    if (mergedIP.includes('.')) {
        const dotIdx = mergedIP.indexOf('.');
        const ipEnd = dotIdx + 2; // IP always has 1 decimal digit
        const ipPart = mergedIP.substring(0, ipEnd);
        const rest = mergedIP.substring(ipEnd);

        if (rest.length >= 5 && !hasSeparateBB) {
            // Large merged token: IP + H + R + ER + BB + K
            const split = splitPitchingMerged(mergedIP);
            if (split) {
                h_pitch = split.h;
                r_pitch = split.r;
                er = split.er;
                bb = split.bb;
                so = split.k;
                mergedIP = split.ip;
            }
        } else if (rest.length >= 3 && hasSeparateBB) {
            // IP + H + R + ER merged (BB and K are separate tokens)
            // rest = H(1-2) + R(1-2) + ER(1-2) with constraint ER ≤ R
            mergedIP = ipPart;
            const solutions: { h: number; r: number; er: number }[] = [];
            for (let h_len = 1; h_len <= 2 && h_len < rest.length - 1; h_len++) {
                const hv = parseInt(rest.substring(0, h_len));
                const r1 = rest.substring(h_len);
                for (let r_len = 1; r_len <= 2 && r_len < r1.length; r_len++) {
                    const rv = parseInt(r1.substring(0, r_len));
                    const erStr = r1.substring(r_len);
                    if (erStr.length === 0 || erStr.length > 2) continue;
                    const erv = parseInt(erStr);
                    if (erv <= rv) {
                        solutions.push({ h: hv, r: rv, er: erv });
                    }
                }
            }
            if (solutions.length >= 1) {
                // Prefer solution where ER is closest to R
                solutions.sort((a, b) => Math.abs(a.er - a.r) - Math.abs(b.er - b.r));
                h_pitch = solutions[0].h;
                r_pitch = solutions[0].r;
                er = solutions[0].er;
            }
        } else if (rest.length >= 1) {
            // IP + H appended: "13.217" → IP=13.2, H=17
            mergedIP = ipPart;
            h_pitch = parseInt(rest) || 0;
        }
    }

    // Handle separate H/R/ER tokens in IP region (x 300-355)
    // These fall within the IP mega range but are separate tokens
    // We already collected them via mergedIP concatenation — but if IP itself was short,
    // the remaining tokens are H, R, ER

    return {
        name: playerName, w, l, app, gs, cg, sho, sv,
        ip: mergedIP || '0',
        h: h_pitch, r: r_pitch, er, bb, so, hr, hbp,
    };
}

/**
 * Parse a GT stats PDF buffer.
 */
async function parseGtechPdf(pdfBuffer: Buffer): Promise<{
    batting: GtechBattingRaw[];
    pitching: GtechPitchingRaw[];
}> {
    const batting: GtechBattingRaw[] = [];
    const pitching: GtechPitchingRaw[] = [];

    const renderPage = (pageData: any) => {
        return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: true })
            .then((textContent: any) => {
                const allItems: TextItem[] = textContent.items
                    .filter((item: any) => item.str.trim() || item.str === ' ')
                    .map((item: any) => ({
                        str: item.str,
                        x: item.transform[4],
                        y: item.transform[5],
                        width: item.width || 0,
                    }));

                allItems.sort((a, b) => {
                    const yDiff = b.y - a.y;
                    if (Math.abs(yDiff) > 3) return yDiff;
                    return a.x - b.x;
                });

                const rows: TextItem[][] = [];
                let currentRow: TextItem[] = [];
                let lastY: number | null = null;
                for (const item of allItems) {
                    if (lastY !== null && Math.abs(item.y - lastY) > 3) {
                        if (currentRow.length > 0) rows.push(currentRow);
                        currentRow = [];
                    }
                    currentRow.push(item);
                    lastY = item.y;
                }
                if (currentRow.length > 0) rows.push(currentRow);

                let section: 'none' | 'batting' | 'pitching' | 'fielding' = 'none';

                for (const row of rows) {
                    const rowText = row.map(r => r.str).join(' ').replace(/\s+/g, ' ');

                    if (rowText.includes('PLAYER') && rowText.includes('AVG') && (rowText.includes('AB') || rowText.includes('GP'))) {
                        section = 'batting';
                        continue;
                    }
                    if (rowText.includes('PLAYER') && rowText.includes('ERA') && rowText.includes('IP')) {
                        section = 'pitching';
                        continue;
                    }
                    if (rowText.includes('PLAYER') && rowText.includes('FLD') && rowText.includes('PO')) {
                        section = 'fielding';
                        continue;
                    }

                    if (rowText.startsWith('-') || rowText.includes('Totals') ||
                        rowText.includes('Opponents') || rowText.includes('LOB') ||
                        rowText.includes('Team') || rowText.includes('Georgia') ||
                        rowText.includes('Record') || rowText.includes('All Games') ||
                        rowText.includes('PB ') || rowText.includes('Season') ||
                        rowText.includes('As of') || rowText.includes('Inn') ||
                        rowText.includes('Pickoffs') || rowText.includes('SBA / ATT') ||
                        rowText.includes('SBA/ATT') ||
                        (rowText.includes(';') && rowText.includes('('))) {
                        continue;
                    }

                    if (row.length < 3) continue;

                    if (section === 'batting') {
                        // Column breaks prevent items from adjacent columns merging into one token
                        // x=525: SB-ATT / PO boundary
                        const tokens = tokenizeRow(row, [525]);
                        const result = parseBattingTokens(tokens);
                        if (result) batting.push(result);
                    }

                    if (section === 'pitching') {
                        const tokens = tokenizeRow(row);
                        const result = parsePitchingTokens(tokens);
                        if (result) pitching.push(result);
                    }
                }

                return '';
            });
    };

    await pdf(pdfBuffer, { pagerender: renderPage });
    return { batting, pitching };
}

// ===== Name matching =====

function normalizeName(name: string): string {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '')
        .trim();
}

function findRosterMatch(pdfName: string, roster: RosterPlayer[]): RosterPlayer | undefined {
    const commaIdx = pdfName.indexOf(',');
    if (commaIdx < 0) return undefined;
    const pdfLast = normalizeName(pdfName.substring(0, commaIdx));
    const pdfFirst = normalizeName(pdfName.substring(commaIdx + 1));

    const lastNameMatches = roster.filter(p => normalizeName(p.lastName) === pdfLast);
    if (lastNameMatches.length === 0) return undefined;
    if (lastNameMatches.length === 1) return lastNameMatches[0];

    return lastNameMatches.find(p => normalizeName(p.firstName) === pdfFirst)
        || lastNameMatches.find(p =>
            normalizeName(p.firstName).startsWith(pdfFirst) ||
            pdfFirst.startsWith(normalizeName(p.firstName)))
        || lastNameMatches[0];
}

export async function mergeGtechStats(
    roster: RosterPlayer[],
    statsUrl: string
): Promise<PlayerStats[]> {
    const response = await fetch(statsUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch GT stats PDF: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { batting, pitching } = await parseGtechPdf(buffer);

    return roster.map(player => {
        const fullName = `${player.firstName} ${player.lastName}`;
        const bat = batting.find(b => findRosterMatch(b.name, [player]) !== undefined);
        const pitch = pitching.find(p => findRosterMatch(p.name, [player]) !== undefined);

        return {
            number: player.number,
            name: fullName,
            ab: bat ? String(bat.ab) : '', r: bat ? String(bat.r) : '',
            h: bat ? String(bat.h) : '', doubles: bat ? String(bat.doubles) : '',
            triples: bat ? String(bat.triples) : '', hr: bat ? String(bat.hr) : '',
            rbi: bat ? String(bat.rbi) : '', bb: bat ? String(bat.bb) : '',
            hbp: bat ? String(bat.hbp) : '', so: bat ? String(bat.so) : '',
            gdp: bat ? String(bat.gdp) : '', sf: bat ? String(bat.sf) : '',
            sh: bat ? String(bat.sh) : '', sb: bat ? String(bat.sb) : '',
            cs: bat ? String(bat.att - bat.sb) : '',
            w: pitch ? String(pitch.w) : '', l: pitch ? String(pitch.l) : '',
            g: pitch ? String(pitch.app) : '', gs: pitch ? String(pitch.gs) : '',
            cg: pitch ? String(pitch.cg) : '', sho: pitch ? String(pitch.sho) : '',
            sv: pitch ? String(pitch.sv) : '', ip: pitch ? pitch.ip : '',
            h_pitch: pitch ? String(pitch.h) : '', r_pitch: pitch ? String(pitch.r) : '',
            er: pitch ? String(pitch.er) : '', bb_pitch: pitch ? String(pitch.bb) : '',
            so_pitch: pitch ? String(pitch.so) : '', hr_pitch: pitch ? String(pitch.hr) : '',
            hbp_pitch: pitch ? String(pitch.hbp) : '',
        };
    });
}
