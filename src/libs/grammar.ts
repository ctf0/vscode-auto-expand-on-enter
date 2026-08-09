import * as vscode from 'vscode'
import {NonCodeRange, isInsideOffsetRange} from './nonCode'
import {getLanguageDelimiters} from './delimiters'

/* ------------------------------------------------------------------ */
/*  Non-code range detection                                           */
/* ------------------------------------------------------------------ */

const rangeCache = new Map<string, {ranges: NonCodeRange[], version: number}>()

export function detectNonCodeRanges(document: vscode.TextDocument): NonCodeRange[] {
    const cacheKey = document.uri.toString()
    const cached = rangeCache.get(cacheKey)

    if (cached && cached.version === document.version) {
        return cached.ranges
    }

    const config = getLanguageDelimiters(document.languageId)
    const ranges: NonCodeRange[] = []
    const fullText = document.getText()

    scanForComments(fullText, config.multiLineComment, ranges)
    scanForStrings(fullText, config.stringDelimiters, config.templateDelimiters, ranges)
    scanForSingleLineComments(document, fullText, config.singleLineComment, ranges)

    ranges.sort((a, b) => a.startOffset - b.startOffset)

    const merged = mergeRanges(ranges)

    rangeCache.set(cacheKey, {ranges: merged, version: document.version})

    if (rangeCache.size > 100) {
        const firstKey = rangeCache.keys().next().value

        if (firstKey) {
            rangeCache.delete(firstKey)
        }
    }

    return merged
}

function scanForComments(
    text: string,
    multiLineComments: [string, string][],
    ranges: NonCodeRange[],
) {
    for (const [open, close] of multiLineComments) {
        let i = 0

        while ((i = text.indexOf(open, i)) !== -1) {
            const startOffset = i
            const closeIdx = text.indexOf(close, i + open.length)

            if (closeIdx === -1) {
                break
            }

            const endOffset = closeIdx + close.length
            ranges.push({
                startOffset,
                endOffset,
                kind : 'comment',
            })
            i = endOffset
        }
    }
}

/* Returns the offset just past the first unescaped `close` found at or
 * after `start`, or -1 when the region is unterminated. */
function findDelimitedEnd(text: string, start: number, close: string): number {
    for (let j = start; j < text.length; j++) {
        if (text[j] === '\\') {
            j++
            continue
        }

        if (text.startsWith(close, j)) {
            return j + close.length
        }
    }

    return -1
}

function scanForStrings(
    text: string,
    stringDelimiters: string[],
    templateDelimiters: [string, string][],
    ranges: NonCodeRange[],
) {
    /* Template regions (backtick for JS, {{ }} for Blade/Twig/etc.) are scanned
     * first so they take priority over string delimiters. */
    for (const [open, close] of templateDelimiters) {
        let i = 0

        while ((i = text.indexOf(open, i)) !== -1) {
            if (isInsideOffsetRange(i, ranges)) {
                i++
                continue
            }

            const end = findDelimitedEnd(text, i + open.length, close)

            if (end === -1) {
                break /* unterminated: stop scanning this delimiter */
            }

            ranges.push({startOffset: i, endOffset: end, kind: 'template'})
            i = end
        }
    }

    /* Single-quote and double-quote strings. */
    for (const delim of stringDelimiters) {
        let i = 0

        while ((i = text.indexOf(delim, i)) !== -1) {
            /* Skip if this offset is inside a comment or template already found. */
            if (isInsideOffsetRange(i, ranges)) {
                i++
                continue
            }

            const end = findDelimitedEnd(text, i + 1, delim)

            if (end === -1) {
                break /* unterminated: stop scanning this delimiter */
            }

            ranges.push({startOffset: i, endOffset: end, kind: 'string'})
            i = end + 1 /* never re-match the closing quote as an opener */
        }
    }
}

function scanForSingleLineComments(
    document: vscode.TextDocument,
    text: string,
    commentMarkers: string[],
    ranges: NonCodeRange[],
) {
    const lineCount = document.lineCount

    for (let line = 0; line < lineCount; line++) {
        const lineText = document.lineAt(line).text

        for (const marker of commentMarkers) {
            const idx = lineText.indexOf(marker)

            if (idx !== -1) {
                const docOffset = document.offsetAt(new vscode.Position(line, idx))

                /* Only treat as a comment if it's not inside a string or template already found. */
                if (!isInsideOffsetRange(docOffset, ranges)) {
                    ranges.push({
                        startOffset : docOffset,
                        endOffset   : docOffset + lineText.length - idx,
                        kind        : 'comment',
                    })
                }
            }
        }
    }
}

function mergeRanges(ranges: NonCodeRange[]): NonCodeRange[] {
    if (ranges.length === 0) {
        return []
    }

    const merged: NonCodeRange[] = [ranges[0]]

    for (let i = 1; i < ranges.length; i++) {
        const last = merged[merged.length - 1]

        if (ranges[i].startOffset <= last.endOffset) {
            if (ranges[i].endOffset > last.endOffset) {
                merged[merged.length - 1] = {...last, endOffset: ranges[i].endOffset}
            }
        } else {
            merged.push(ranges[i])
        }
    }

    return merged
}

/* ------------------------------------------------------------------ */
/*  Public helpers for bracket matching                                 */
/* ------------------------------------------------------------------ */

/**
 * Return `true` if `position` falls inside a string, comment, or template
 * literal region in the document.
 */
export function isPositionInNonCode(document: vscode.TextDocument, position: vscode.Position): boolean {
    const posOffset = document.offsetAt(position)
    const ranges = detectNonCodeRanges(document)

    return isInsideOffsetRange(posOffset, ranges)
}
