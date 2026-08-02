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
    return txt
        .replace(/(?<=['"\S])([\t ]+)?,(?![\t ]*[)\]\}])([\t ]+)?['"\S]/g, (match, off: string, _afterWs: string, offset: number, str: string) => {
            if (match[match.length - 1] === '[') {
                return match
            }

            let bracketDepth = 0
            let arrayDepth = 0

            for (let i = 0; i < offset; i++) {
                if (str[i] === '[') {
                    arrayDepth++
                } else if (str[i] === ']') {
                    arrayDepth--
                } else if (str[i] === '(' || str[i] === '{') {
                    bracketDepth++
                } else if (str[i] === ')' || str[i] === '}') {
                    bracketDepth--
                }
            }

            if (arrayDepth > 0) {
                return match
            }

            const lineStart = str.lastIndexOf('\n', offset) + 1
            const linePrefix = str.slice(lineStart, offset)
            const lineIndent = extractIndent(linePrefix)
            const indent = bracketDepth > 0 ? lineIndent + indentUnit : lineIndent

            return match.replace(/,[\t ]*/, `,${EOL}${indent}`)
        })
        .replace(/\(([^)\[\]]*\n[^)\[\]]*)\)/g, (match, inner: string, offset: number, str: string) => {
            const beforeParen = str.slice(0, offset)
            const lineStart = beforeParen.lastIndexOf('\n') + 1
            const lineIndent = extractIndent(beforeParen.slice(lineStart))
            const contentIndent = lineIndent + indentUnit

            return `(\n${contentIndent}${inner}\n${lineIndent})`
        })
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
