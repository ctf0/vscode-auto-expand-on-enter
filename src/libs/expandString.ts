import {EOL} from 'os'

export function contentExpand(txt: string, tabSize: number, insertSpaces: boolean): string {
    const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '\t'
    const match = txt.match(/^[\t ]+/)
    const space = match?.[0] ?? ''
    const chainIndent = space + indentUnit

    let chainIndex = 0

    return txt
        .replace(/\s*(->|\.(?!\d))/g, (match, operator, offset, str) => {
            const parenDepth = (str.slice(0, offset).match(/\(/g) || []).length - (str.slice(0, offset).match(/\)/g) || []).length

            if (parenDepth > 0) {
                return match
            }

            const beforeOp = str.slice(0, offset).trimEnd()

            if (/\$\w+$/.test(beforeOp)) {
                return match
            }

            chainIndex++

            return offset === 0 ? match : `${EOL}${chainIndent}${operator}`
        })
        .replace(/([\t ]+)?(\&{2,}|\|{2,})([\t ]+)?/g, (match) => `${match.trimEnd()}${EOL}${chainIndent}`)
        .replace(/\[([^\]]+)\]/g, (match, content, offset, str) => {
            if (!content.includes(',')) {
                return match
            }

            const lineStart = str.lastIndexOf('\n', offset) + 1
            const linePrefix = str.slice(lineStart, offset)
            const containingLineIndent = linePrefix.match(/^[\t ]*/)?.[0] ?? ''
            const elements = content.split(',').map((s) => s.trim()).filter(Boolean)

            return `[\n${containingLineIndent}${indentUnit}${elements.join(`,\n${containingLineIndent}${indentUnit}`)}\n${containingLineIndent}]`
        })
        .replace(/(?<=['"\S])([\t ]+)?,([\t ]+)?['"\S]/g, (match, off, _afterWs, offset, str) => {
            if (match[match.length - 1] === '[') {
                return match
            }

            let bracketDepth = 0

            for (let i = 0; i < offset; i++) {
                if (str[i] === '[' || str[i] === '(') {
                    bracketDepth++
                } else if (str[i] === ']' || str[i] === ')') {
                    bracketDepth--
                }
            }

            const lineStart = str.lastIndexOf('\n', offset) + 1
            const linePrefix = str.slice(lineStart, offset)
            const lineIndent = linePrefix.match(/^[\t ]*/)?.[0] ?? ''
            const indent = bracketDepth > 0 ? lineIndent + indentUnit : lineIndent

            return match.replace(/,[\t ]*/, `,${EOL}${indent}`)
        })
        .replace(/\(([^)\[\]]*\n[^)\[\]]*)\)/g, (match, inner, offset, str) => {
            const beforeParen = str.slice(0, offset)
            const lineStart = beforeParen.lastIndexOf('\n') + 1
            const lineIndent = (beforeParen.slice(lineStart).match(/^[\t ]*/)?.[0] ?? '')
            const contentIndent = lineIndent + indentUnit

            return `(\n${contentIndent}${inner}\n${lineIndent})`
        })
}
