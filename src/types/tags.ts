import * as vscode from 'vscode'
import {extractIndent} from '../libs/indent'

let cachedSymbols: vscode.DocumentSymbol[] | undefined
let cachedUri = ''
let cachedVersion = -1

interface TagResult {
    tagName   : string
    symbol    : vscode.DocumentSymbol
    direction : 'toLeft' | 'toRight'
}

interface TagSelectionResult extends Array<vscode.Selection> {
    tagOpeningIndent?  : string
    _closingIndentKey? : string
}

export async function getTagCharResult(document: vscode.TextDocument, end: vscode.Position): Promise<TagResult | null> {
    let symbols: vscode.DocumentSymbol[] | undefined

    try {
        if (cachedUri === document.uri.toString() && cachedVersion === document.version) {
            symbols = cachedSymbols
        } else {
            symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri,
            )

            cachedUri = document.uri.toString()
            cachedVersion = document.version
            cachedSymbols = symbols
        }
    } catch {
        return null
    }

    if (!symbols?.length) {
        return null
    }

    const {line, character} = end
    const allSymbols = flattenSymbols(symbols)

    for (const sym of allSymbols) {
        // 1. Cursor at end of the opening tag → add \n after open tag & before close tag
        const openTagEnd = findOpenTagEnd(sym, document)

        if (openTagEnd && openTagEnd.line === line && openTagEnd.character === character) {
            const closeTagPos = findCloseTagStart(sym, document)

            if (!closeTagPos) {
                continue
            }

            return {
                tagName   : sym.name,
                symbol    : sym,
                direction : 'toRight',
            }
        }

        // 2. Cursor right before the closing tag → add \n before close tag & after open tag
        const closeTagPos = findCloseTagStart(sym, document)

        if (closeTagPos && closeTagPos.line === line && closeTagPos.character === character) {
            return {
                tagName   : sym.name,
                symbol    : sym,
                direction : 'toLeft',
            }
        }
    }

    return null
}

export function createTagSelections(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    tagResult: TagResult,
    _before: string,
    _after: string,
): TagSelectionResult | false {
    const {end} = selection
    const {document} = editor
    const {direction, symbol} = tagResult

    const tagLineText = document.lineAt(symbol.range.start.line).text
    const tagIndent = extractIndent(tagLineText)

    if (direction === 'toRight') {
        if (!_after) {
            return false
        }

        // Cursor after open tag — insert \n after open tag & before close tag
        const closeTagPos = findCloseTagStart(symbol, document)

        if (!closeTagPos) {
            return false
        }

        const result: TagSelectionResult = [
            new vscode.Selection(end, end),
            new vscode.Selection(closeTagPos, closeTagPos),
        ]

        result.tagOpeningIndent = tagIndent
        result._closingIndentKey = `${closeTagPos.line}:${closeTagPos.character}`

        return result
    }

    if (!_before) {
        return false
    }

    // Cursor before close tag — insert \n before close tag & after open tag
    const openTagEnd = findOpenTagEnd(symbol, document)

    if (!openTagEnd) {
        return false
    }

    const result: TagSelectionResult = [
        new vscode.Selection(end, end),
        new vscode.Selection(openTagEnd, openTagEnd),
    ]

    result.tagOpeningIndent = tagIndent

    return result
}

/* Helpers ---------------------------------------------------------------- */

function flattenSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
    const result: vscode.DocumentSymbol[] = []

    for (const sym of symbols) {
        result.push(sym)

        if (sym.children?.length) {
            result.push(...flattenSymbols(sym.children))
        }
    }

    return result
}

function findOpenTagEnd(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): vscode.Position | null {
    // Scan from the element start to find the closing > of the open tag,
    // skipping > inside quoted attribute values.
    const text = document.getText(
        new vscode.Range(symbol.range.start, symbol.range.end),
    )

    let inQuote: string | null = null

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]

        if (inQuote) {
            if (ch === inQuote) {
                inQuote = null
            }
        } else if (ch === '"' || ch === '\'') {
            inQuote = ch
        } else if (ch === '>') {
            if (i > 0 && text[i - 1] === '/') {
                return null // self-closing tag, nothing to expand
            }

            const absoluteOffset = document.offsetAt(symbol.range.start) + i

            return document.positionAt(absoluteOffset + 1)
        }
    }

    return null
}

function findCloseTagStart(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): vscode.Position | null {
    const rangeEnd = symbol.range.end
    const lineText = document.lineAt(rangeEnd.line).text.slice(0, rangeEnd.character)
    const closeTagIdx = lineText.lastIndexOf('</')

    if (closeTagIdx === -1) {
        return null
    }

    return new vscode.Position(rangeEnd.line, closeTagIdx)
}
