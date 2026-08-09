import {EOL} from 'os'
import {maskLiterals, restoreLiterals} from './literal'
import {extractIndent} from './indent'

function expandChainOperators(txt: string, indentUnit: string, chainIndent: string): string {
    let chainIndex = 0

    return txt.replace(/\s*(->|\?\.|\.(?!\d))/g, (match, operator: string, offset: number, str: string) => {
        const prefix = str.slice(0, offset)
        let parenDepth = 0

        for (let i = 0; i < prefix.length; i++) {
            if (prefix[i] === '(') {
                parenDepth++
            } else if (prefix[i] === ')') {
                parenDepth--
            }
        }

        if (parenDepth > 0) {
            return match
        }

        if (str[offset - 1] === '.' || str[offset + operator.length] === '.') {
            return match
        }

        const beforeOp = str.slice(0, offset).trimEnd()

        if (/\$\w+$/.test(beforeOp)) {
            return match
        }

        chainIndex++

        return offset === 0 ? match : `${EOL}${chainIndent}${operator}`
    })
}

function expandBooleanOperators(txt: string, chainIndent: string): string {
    return txt.replace(/([\t ]+)?(\&{2,}|\|{2,})([\t ]+)?/g, (match) => `${match.trimEnd()}${EOL}${chainIndent}`)
}

function expandTernaryOperators(txt: string, chainIndent: string): string {
    return txt
        .replace(/(?<=\S)([\t ]+)\?([\t ]+)/g, (_match, _pre: string, post: string) => `${EOL}${chainIndent}?${post}`)
        .replace(/(?<=\S)([\t ]+):([\t ]+)/g, (_match, _pre: string, post: string) => `${EOL}${chainIndent}:${post}`)
}

function expandArrayElements(txt: string, indentUnit: string): string {
    /* Scan the *outermost* balanced `[...]` spans: the old regex
     * /\[([^\]]+)\]/ stopped at the first `]` and broke nested arrays. */
    let result = ''
    let i = 0

    while (i < txt.length) {
        const open = txt.indexOf('[', i)

        if (open === -1) {
            result += txt.slice(i)
            break
        }

        result += txt.slice(i, open)

        let depth = 0
        let j = open

        while (j < txt.length) {
            if (txt[j] === '[') {
                depth++
            } else if (txt[j] === ']') {
                depth--

                if (depth === 0) {
                    break
                }
            }

            j++
        }

        if (j >= txt.length) {
            result += txt.slice(open)
            break
        }

        const inner = txt.slice(open + 1, j)
        const elements = splitTopLevel(inner, ',')

        if (elements.length <= 1) {
            result += txt.slice(open, j + 1)
        } else {
            const lineStart = txt.lastIndexOf('\n', open) + 1
            const linePrefix = txt.slice(lineStart, open)
            const containingLineIndent = extractIndent(linePrefix)
            const elementIndent = containingLineIndent + indentUnit

            result += `[\n${elementIndent}${elements.join(`,\n${elementIndent}`)}\n${containingLineIndent}]`
        }

        i = j + 1
    }

    return result
}

function splitTopLevel(text: string, separator: string): string[] {
    const parts: string[] = []
    let depth = 0
    let start = 0

    for (let i = 0; i < text.length; i++) {
        const c = text[i]

        if (c === '[' || c === '(' || c === '{') {
            depth++
        } else if (c === ']' || c === ')' || c === '}') {
            depth--
        } else if (c === separator && depth === 0) {
            parts.push(text.slice(start, i).trim())
            start = i + 1
        }
    }

    parts.push(text.slice(start).trim())

    return parts.filter((part) => part !== '')
}

function expandFunctionArguments(txt: string, indentUnit: string): string {
    return formatCallGroups(txt, indentUnit)
}

/* Recursive call-group formatter.
 *
 * A `(...)` group expands when its content needs a break: a non-guarded
 * comma or an existing newline outside array spans, or an argument that is
 * itself a call group needing a break (so `f(g(a, b))` wraps both levels).
 * Groups that stay inline are still recursively formatted, so the wrapped
 * inner group keeps the outer one on the same line only when it fits. */
function formatCallGroups(txt: string, indentUnit: string): string {
    let out = ''
    let i = 0
    let arrayDepth = 0
    let braceDepth = 0

    while (i < txt.length) {
        const c = txt[i]

        if (c === '[') {
            arrayDepth++
        } else if (c === ']') {
            arrayDepth = Math.max(0, arrayDepth - 1)
        } else if (c === '{') {
            braceDepth++
        } else if (c === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
        }

        if (arrayDepth > 0 || c !== '(') {
            if (c === ',' && arrayDepth === 0 && !isCommaGuard(txt, i)) {
                const lineStart = txt.lastIndexOf('\n', i) + 1
                const lineIndent = extractIndent(txt.slice(lineStart, i))
                const indent = braceDepth > 0 ? lineIndent + indentUnit : lineIndent

                out += ',' + EOL + indent
                i++

                while (i < txt.length && (txt[i] === ' ' || txt[i] === '\t')) {
                    i++
                }

                continue
            }

            out += c
            i++
            continue
        }

        const close = findMatchingParen(txt, i)

        if (close === -1) {
            out += txt.slice(i)
            break
        }

        const inner = txt.slice(i + 1, close)
        const lineStart = txt.lastIndexOf('\n', i) + 1
        const baseIndent = extractIndent(txt.slice(lineStart, i))

        if (!needsBreak(inner)) {
            out += '(' + formatCallGroups(inner, indentUnit) + ')'
        } else {
            const parts = splitCallParts(inner)
            const contentIndent = baseIndent + indentUnit

            out += '('

            for (let p = 0; p < parts.length; p++) {
                out += (p > 0 ? ',' : '') + EOL + pushPart(formatCallGroups(parts[p], indentUnit), contentIndent)
            }

            out += EOL + baseIndent + ')'
        }

        i = close + 1
    }

    return out
}

function findMatchingParen(text: string, open: number): number {
    let depth = 0

    for (let j = open; j < text.length; j++) {
        if (text[j] === '(') {
            depth++
        } else if (text[j] === ')') {
            depth--

            if (depth === 0) {
                return j
            }
        }
    }

    return -1
}

/* A group needs a break when any top-level argument is split: multiple
 * args, an already-broken line (ternary / boolean), or an argument call
 * group that itself needs a break. Arrays are atomic — a broken array
 * never forces its containing call to wrap. */
function needsBreak(inner: string): boolean {
    let arrayDepth = 0

    for (let i = 0; i < inner.length; i++) {
        const c = inner[i]

        if (c === '[') {
            arrayDepth++
        } else if (c === ']') {
            arrayDepth = Math.max(0, arrayDepth - 1)
        } else if (arrayDepth === 0) {
            if (c === '\n') {
                return true
            }

            if (c === ',' && !isCommaGuard(inner, i)) {
                return true
            }

            if (c === '(') {
                const close = findMatchingParen(inner, i)

                if (close !== -1) {
                    if (needsBreak(inner.slice(i + 1, close))) {
                        return true
                    }

                    i = close
                }
            }
        }
    }

    return false
}

/* A comma is a trailing comma — not an argument separator — when the next
 * non-space character is an argument-list closer, the group's own end, or
 * the end of the line (an already-broken list must not double-break). */
function isCommaGuard(text: string, commaIndex: number): boolean {
    let j = commaIndex + 1

    while (j < text.length && (text[j] === ' ' || text[j] === '\t')) {
        j++
    }

    return j >= text.length
      || text[j] === ')'
      || text[j] === ']'
      || text[j] === '}'
      || text[j] === '['
      || text[j] === '\n'
      || text[j] === '\r'
}

function splitCallParts(inner: string): string[] {
    const parts: string[] = []
    let depth = 0
    let start = 0

    for (let i = 0; i < inner.length; i++) {
        const c = inner[i]

        if (c === '(' || c === '[' || c === '{') {
            depth++
        } else if (c === ')' || c === ']' || c === '}') {
            depth = Math.max(0, depth - 1)
        } else if (c === ',' && depth === 0 && !isCommaGuard(inner, i)) {
            parts.push(inner.slice(start, i).trim())
            start = i + 1
        }
    }

    parts.push(inner.slice(start).trim())

    return parts.filter((part) => part !== '')
}

/* Emit one argument at `indent`. Continuation lines keep their relative
 * indentation while the part is inside brackets (nested calls / arrays)
 * and flatten to `indent` on direct continuation lines (ternary / boolean). */
function pushPart(part: string, indent: string): string {
    const lines = part.split('\n')
    const first = lines[0] ?? ''
    const anchor = extractIndent(first)
    let out = indent + first
    let parenDepth = 0
    let arrayDepth = 0

    for (const c of first) {
        if (c === '(') {
            parenDepth++
        } else if (c === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
        } else if (c === '[') {
            arrayDepth++
        } else if (c === ']') {
            arrayDepth = Math.max(0, arrayDepth - 1)
        }
    }

    for (let k = 1; k < lines.length; k++) {
        const line = lines[k]
        const origIndent = extractIndent(line)
        const indentToUse = (parenDepth > 0 || arrayDepth > 0) ? indent + origIndent.slice(anchor.length) : indent

        out += EOL + indentToUse + line.slice(origIndent.length)

        for (const c of line) {
            if (c === '(') {
                parenDepth++
            } else if (c === ')') {
                parenDepth = Math.max(0, parenDepth - 1)
            } else if (c === '[') {
                arrayDepth++
            } else if (c === ']') {
                arrayDepth = Math.max(0, arrayDepth - 1)
            }
        }
    }

    return out
}

export function contentExpand(txt: string, tabSize: number, insertSpaces: boolean, languageId?: string): string {
    const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '\t'
    const space = extractIndent(txt)
    const chainIndent = space + indentUnit

    const {masked, literals} = maskLiterals(txt, languageId)
    let result = masked
    result = expandChainOperators(result, indentUnit, chainIndent)
    result = expandBooleanOperators(result, chainIndent)
    result = expandTernaryOperators(result, chainIndent)
    result = expandArrayElements(result, indentUnit)
    result = expandFunctionArguments(result, indentUnit)

    return restoreLiterals(result, literals)
}
