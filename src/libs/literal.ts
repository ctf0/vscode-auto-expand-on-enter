import {getLanguageDelimiters, isJsLike} from './delimiters'
import {isInsideOffsetRange, NonCodeRange} from './nonCode'

/**
 * Literal-aware masking for the content expander.
 *
 * Pure module (no vscode import): strings, templates, comments and (for
 * JS-family languages) regex literals are replaced by inert placeholders
 * before the expansion regexes run, then restored verbatim. This keeps
 * the expander from breaking text inside literals, e.g.:
 *
 *     foo('a, b')   ->  stays intact (was: broken across lines)
 *     /a, b/g       ->  stays intact
 */

export interface LiteralRange {
    readonly startOffset : number
    readonly endOffset   : number
    readonly kind        : NonCodeRange['kind']
    readonly value       : string
}

export interface MaskResult {
    masked   : string
    literals : LiteralRange[]
}

const PLACEHOLDER_OPEN  = '\u0000L'
const PLACEHOLDER_CLOSE = '\u0000'

/* The placeholder token keeps every character out of the regexes the
 * expander runs (no `, . - > ? : & | [ ] ( ) { } ' " ` whitespace). */
function placeholder(index: number): string {
    return `${PLACEHOLDER_OPEN}${index}${PLACEHOLDER_CLOSE}`
}

/* Regex literals only exist in the JS family (see isJsLike in delimiters). */

export function maskLiterals(text: string, languageId?: string): MaskResult {
    const config = getLanguageDelimiters(languageId ?? '')
    const ranges: LiteralRange[] = []

    /* 1. Template regions (backticks, {{ }} pairs, python """ ... """). */
    scanDelimited(text, config.templateDelimiters, 'template', ranges)

    /* 2. Quoted strings. */
    for (const delim of config.stringDelimiters) {
        if (delim) {
            scanStrings(text, delim, 'string', ranges)
        }
    }

    /* 3. Multi-line comments. */
    scanDelimited(text, config.multiLineComment, 'comment', ranges)

    /* 4. Single-line comments. */
    scanSingleLineComments(text, config.singleLineComment, ranges)

    /* 5. Regex literals last: any `/` still outside the ranges above. */
    if (languageId && isJsLike(languageId)) {
        scanRegexLiterals(text, ranges)
    }

    ranges.sort((a, b) => a.startOffset - b.startOffset)

    const ordered: LiteralRange[] = []
    let lastEnd = -1

    for (const r of ranges) {
        if (r.startOffset < lastEnd) {
            continue
        }

        ordered.push(r)
        lastEnd = r.endOffset
    }

    return {masked: buildMasked(text, ordered), literals: ordered}
}

export function restoreLiterals(masked: string, literals: LiteralRange[]): string {
    let out = masked

    for (let i = 0; i < literals.length; i++) {
        out = out.split(placeholder(i)).join(literals[i].value)
    }

    return out
}

function buildMasked(text: string, ranges: LiteralRange[]): string {
    if (ranges.length === 0) {
        return text
    }

    let out = ''
    let cursor = 0

    for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i]
        out += text.slice(cursor, r.startOffset) + placeholder(i)
        cursor = r.endOffset
    }

    out += text.slice(cursor)

    return out
}

function scanDelimited(text: string, pairs: [string, string][], kind: LiteralRange['kind'], ranges: LiteralRange[]): void {
    for (const [open, close] of pairs) {
        let i = 0

        while ((i = text.indexOf(open, i)) !== -1) {
            if (isInsideOffsetRange(i, ranges)) {
                i++
                continue
            }

            const closeIdx = text.indexOf(close, i + open.length)

            if (closeIdx === -1) {
                break
            }

            const end = closeIdx + close.length
            ranges.push({startOffset: i, endOffset: end, kind, value: text.slice(i, end)})
            i = end
        }
    }
}

function scanStrings(text: string, delim: string, kind: LiteralRange['kind'], ranges: LiteralRange[]): void {
    let i = 0

    while ((i = text.indexOf(delim, i)) !== -1) {
        if (isInsideOffsetRange(i, ranges)) {
            i++
            continue
        }

        let j = i + 1

        while (j < text.length && text[j] !== delim) {
            if (text[j] === '\\') {
                j += 2
            } else {
                j++
            }
        }

        if (j >= text.length) {
            /* Unterminated on this line: leave it untouched. */
            i++
            continue
        }

        const end = j + 1
        ranges.push({startOffset: i, endOffset: end, kind, value: text.slice(i, end)})
        i = end
    }
}

function scanSingleLineComments(text: string, markers: string[], ranges: LiteralRange[]): void {
    for (const marker of markers) {
        let i = 0

        while ((i = text.indexOf(marker, i)) !== -1) {
            if (!isInsideOffsetRange(i, ranges)) {
                const lineEnd = text.indexOf('\n', i)
                const end = lineEnd === -1 ? text.length : lineEnd
                ranges.push({startOffset: i, endOffset: end, kind: 'comment', value: text.slice(i, end)})
            }

            i++
        }
    }
}

const IDENTIFIER_CHARS = new Set(`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$)]}.'"\``)

function isIdentifierChar(c: string): boolean {
    return IDENTIFIER_CHARS.has(c)
}

function isAsciiLetter(c: string): boolean {
    const code = c.charCodeAt(0)

    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function scanRegexLiterals(text: string, ranges: LiteralRange[]): void {
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== '/' || isInsideOffsetRange(i, ranges)) {
            continue
        }

        /* A `/` starts a regex only when it cannot be division: it must not
         * follow an identifier, digit, closing bracket, quote, or `.`. */
        const prev = i === 0 ? '' : text[i - 1]

        if (prev !== '' && isIdentifierChar(prev)) {
            continue
        }

        let j = i + 1
        let inClass = false

        while (j < text.length) {
            const c = text[j]

            if (c === '\\') {
                j += 2
                continue
            }

            if (c === '[') {
                inClass = true
                j++
                continue
            }

            if (c === ']' && inClass) {
                inClass = false
                j++
                continue
            }

            if (c === '/' && !inClass) {
                let k = j + 1

                while (k < text.length && isAsciiLetter(text[k])) {
                    k++
                }

                ranges.push({startOffset: i, endOffset: k, kind: 'string', value: text.slice(i, k)})
                i = k
                break
            }

            if (c === '\n') {
                /* Unterminated: not a regex literal, keep as-is. */
                break
            }

            j++
        }
    }
}
