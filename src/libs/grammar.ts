import * as vscode from 'vscode'
import {NonCodeRange, isInsideOffsetRange} from './nonCode'
import {getLanguageDelimiters, LanguageDelimiters} from './delimiters'

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

    scanForComments(document, fullText, config.multiLineComment, ranges)
    scanForStrings(document, fullText, config.stringDelimiters, config.templateDelimiters, ranges)
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
    document: vscode.TextDocument,
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

function scanForStrings(
    document: vscode.TextDocument,
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

            const startOffset = i
            /* Find the matching close, respecting escapes. */
            let j = i + open.length

            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2
                    continue
                }

                if (text.startsWith(close, j)) {
                    const endOffset = j + close.length
                    ranges.push({
                        startOffset,
                        endOffset,
                        kind : 'template',
                    })
                    i = endOffset
                    break
                }

                j++
            }

            if (j >= text.length) {
                break
            }
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

            const startOffset = i
            /* Find the matching close, respecting escapes. */
            let j = i + 1

            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2
                    continue
                }

                if (text[j] === delim) {
                    const endOffset = j + 1
                    ranges.push({
                        startOffset,
                        endOffset,
                        kind : 'string',
                    })
                    i = endOffset
                    break
                }

                j++
            }

            if (j >= text.length) {
                break
            }

            i++
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
