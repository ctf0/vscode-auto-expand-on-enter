import * as vscode from 'vscode'
import {NonCodeRange, isInsideOffsetRange} from './nonCode'

/* Language groups share the same string/comment delimiters.
 * A match function replaces the per-language lookup table. */
interface LanguageDelimiters {
    singleLineComment  : string[]
    multiLineComment   : [string, string][]
    stringDelimiters   : string[]
    templateDelimiters : [string, string][]
}

const defaultDelimiters: LanguageDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const cStyleDelimiters: LanguageDelimiters = {
    singleLineComment  : ['//'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const slashHashDelimiters: LanguageDelimiters = {
    singleLineComment  : ['//', '#'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const hashDelimiters: LanguageDelimiters = {
    singleLineComment  : ['#'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const dashDelimiters: LanguageDelimiters = {
    singleLineComment  : ['--'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const exclamationDelimiters: LanguageDelimiters = {
    singleLineComment  : ['!'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

function matchDelimiters(languageId: string): LanguageDelimiters {
    switch (true) {
        case /^(typescript|javascript)react?$/.test(languageId):
            return {...cStyleDelimiters, templateDelimiters: [['`', '`']]}
        case /^(jsx|tsx)$/.test(languageId):
            return {...cStyleDelimiters, templateDelimiters: [['`', '`']]}
        case /^(blade|twig|jinja|handlebars|hbs|ejs|pug|jade|haml|slim|vue)$/.test(languageId):
            return {...cStyleDelimiters, templateDelimiters: [['{{', '}}']]}
        case languageId === 'php':
            return slashHashDelimiters
        case languageId === 'python':
            return {
                singleLineComment  : ['#'],
                multiLineComment   : [['"""', '"""'], ['\'\'\'', '\'\'\'']],
                stringDelimiters   : ['"', '\''],
                templateDelimiters : [],
            }
        case /^(go|rust|java|csharp|cpp|c|objc|swift|kotlin|scala|dart|solidity|elm|erlang|haskell)$/.test(languageId):
            return cStyleDelimiters
        case /^(ruby|perl|r|matlab|elixir)$/.test(languageId):
            return hashDelimiters
        case /^(css|scss|less|shellscript|bash|zsh|sh|powershell)$/.test(languageId):
            return cStyleDelimiters
        case languageId === 'sql':
            return {
                singleLineComment  : ['--'],
                multiLineComment   : [['/*', '*/']],
                stringDelimiters   : ['\'', '"'],
                templateDelimiters : [],
            }
        case languageId === 'lua':
            return {
                singleLineComment  : ['--'],
                multiLineComment   : [['--[[', ']]']],
                stringDelimiters   : ['"', '\''],
                templateDelimiters : [],
            }
        case /^(html|xml|svg|markdown|json|yaml|toml|ini|dockerfile|haml)$/.test(languageId):
            return {
                singleLineComment : [],
                multiLineComment  : languageId === 'html' || languageId === 'xml' || languageId === 'svg' || languageId === 'markdown'
                    ? [['<!--', '-->']]
                    : [],
                stringDelimiters   : ['"', '\''],
                templateDelimiters : [],
            }
        case languageId === 'svelte':
            return {
                singleLineComment  : ['<!--'],
                multiLineComment   : [],
                stringDelimiters   : ['"', '\''],
                templateDelimiters : [],
            }
        case languageId === 'fortran':
            return exclamationDelimiters
        case languageId === 'clojure':
            return {singleLineComment: [';'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []}
        case languageId === 'cobol':
            return {singleLineComment: ['*'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []}
        default:
            return defaultDelimiters
    }
}

/* ------------------------------------------------------------------ */
/*  Non-code range detection                                           */
/* ------------------------------------------------------------------ */

/**
 * Detect all non-code ranges (strings, comments, templates) in the given
 * document using language-specific grammar rules.
 *
 * The detection is intentionally approximate — it handles the common cases
 * and avoids false positives in brackets.ts.
 */
export function detectNonCodeRanges(document: vscode.TextDocument): NonCodeRange[] {
    const config = matchDelimiters(document.languageId)
    const ranges: NonCodeRange[] = []
    /* We'll use line-level scanning to keep it efficient. */
    const fullText = document.getText()

    scanForComments(document, fullText, config.multiLineComment, ranges)
    scanForStrings(document, fullText, config.stringDelimiters, config.templateDelimiters, ranges)
    scanForSingleLineComments(document, fullText, config.singleLineComment, ranges)

    /* Sort and merge overlapping ranges. */
    ranges.sort((a, b) => a.startOffset - b.startOffset)

    return mergeRanges(ranges)
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
    /* Template strings (backtick) are scanned first so they take priority. */
    for (const [open, close] of templateDelimiters) {
        let i = 0

        while ((i = text.indexOf(open, i)) !== -1) {
            const startOffset = i
            /* Find the matching close, respecting escapes. */
            let j = i + 1

            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2
                    continue
                }

                if (text[j] === '`') {
                    const endOffset = j + 1
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
                last.endOffset = ranges[i].endOffset
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
