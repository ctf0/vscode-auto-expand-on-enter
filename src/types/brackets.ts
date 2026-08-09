import escapeStringRegexp from 'escape-string-regexp'
import * as vscode from 'vscode'
import {detectNonCodeRanges} from '../libs/grammar'
import {extractIndent} from '../libs/indent'
import {NonCodeRange, isInsideOffsetRange} from '../libs/nonCode'
import {getText, getPositions, SelectionList} from '../shared'

interface CharResult {
    before    : string
    after     : string
    char      : string
    direction : 'toLeft' | 'toRight' | ''
}

export async function createBracketSelections(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    charsList: Record<string, string>,
    open: string[],
    close: string[],
): Promise<SelectionList | false> {
    const {end} = selection
    const {document} = editor

    const nonCodeRanges = detectNonCodeRanges(document)

    const result = getCharResult(document, end, open, close)

    if (!result.char || !result.direction) {
        return false
    }

    const {char, direction, before, after} = result
    const isRight = direction !== 'toLeft'
    const openChar = isRight ? char.trim() : open.find((key) => charsList[key] === char.trim())
    const closeChar = isRight ? charsList[openChar!] : char.trim()

    if (!openChar || !closeChar) {
        return false
    }

    const bracketOffset = isRight
        ? document.offsetAt(end) - char.length
        : document.offsetAt(end)

    if (isInsideOffsetRange(bracketOffset, nonCodeRanges, {excludeKinds: ['template']})) {
        return false
    }

    const searchIn = getText(direction as 'toLeft' | 'toRight', document, end, char.length)
    const offset = getOffset(isRight, searchIn, openChar, closeChar, char.length, document, end, nonCodeRanges)

    if (offset === undefined) {
        return false
    }

    const positions = getPositions(direction as 'toLeft' | 'toRight', document, end, offset, isRight ? char.length : openChar.length, before, after) as SelectionList

    if (positions.length < 2 || !hasContentAroundPair(document, end, char, openChar, closeChar, positions, isRight)) {
        return false
    }

    if (openChar === '>' && closeChar === '<') {
        positions.tagOpeningIndent = findOpeningTagIndent(document, end)
        const closingPos = isRight ? positions[1].start : end
        positions._closingIndentKey = `${closingPos.line}:${closingPos.character}`
    }

    return positions
}

function hasContentAroundPair(
    document: vscode.TextDocument,
    end: vscode.Position,
    char: string,
    openChar: string,
    closeChar: string,
    positions: vscode.Selection[],
    isRight: boolean,
): boolean {
    const openOffset = isRight
        ? document.offsetAt(end) - char.length
        : document.offsetAt(positions[1].start) - openChar.length
    const closeOffset = isRight
        ? document.offsetAt(positions[1].start)
        : document.offsetAt(end) + char.length - closeChar.length
    const openPosition = document.positionAt(openOffset)
    const closePosition = document.positionAt(closeOffset)
    const beforeOpen = document.lineAt(openPosition.line).text.slice(0, openPosition.character)

    if (openChar.length > 1) {
        return true
    }

    return Boolean(beforeOpen.trim())
}

/* Chars ------------------------------------------------------------------- */
function findOpeningTagIndent(document: vscode.TextDocument, end: vscode.Position): string {
    let line = end.line

    while (line >= 0) {
        const text = document.lineAt(line).text
        const ltIdx = text.indexOf('<')

        if (ltIdx !== -1 && !text.slice(0, ltIdx).trim() && /^<[\w:-]/.test(text.slice(ltIdx))) {
            return extractIndent(text)
        }

        line--
    }

    return extractIndent(document.lineAt(end.line).text)
}

function getChar(document: vscode.TextDocument, range: vscode.Range, regex: RegExp): string {
    const match = document.getText(range).match(regex)

    return match ? match[0] : ''
}

function getCharResult(document: vscode.TextDocument, end: vscode.Position, open: string[], close: string[]): CharResult {
    const {line, character} = end
    const lineText = document.lineAt(line).text

    const before = getChar(document, new vscode.Range(line, 0, line, character), /(\S([\t ]+)?)$/)
    const after = getChar(document, new vscode.Range(line, character, line, lineText.length), /^(([\t ]+)?\S)/)
    const openBefore = getConfiguredChar(lineText.slice(0, character), open, true)
    const closeAfter = getConfiguredChar(lineText.slice(character), close, false)

    if (closeAfter) {
        return {char: closeAfter, direction: 'toLeft', before, after}
    }

    if (openBefore) {
        return {char: openBefore, direction: 'toRight', before, after}
    }

    return {char: '', direction: '', before, after}
}

function getConfiguredChar(text: string, chars: string[], fromEnd: boolean): string {
    for (const char of [...chars].sort((a, b) => b.length - a.length)) {
        const regex = fromEnd
            ? new RegExp(`${escapeStringRegexp(char)}[\\t ]*$`)
            : new RegExp(`^[\\t ]*${escapeStringRegexp(char)}`)
        const match = text.match(regex)

        if (match) {
            return match[0]
        }
    }

    return ''
}

/* Offset ------------------------------------------------------------------ */
function getOffset(
    isRight: boolean,
    txt: string,
    openChar: string,
    closeChar: string,
    boundaryLength: number,
    document: vscode.TextDocument,
    end: vscode.Position,
    nonCodeRanges: NonCodeRange[],
): number | undefined {
    const regex = `${escapeStringRegexp(openChar)}|${escapeStringRegexp(closeChar)}`
    const startDocOffset = isRight
        ? document.offsetAt(end) - boundaryLength
        : 0

    return isRight
        ? getCharOffsetRight(txt, regex, openChar, nonCodeRanges, startDocOffset)
        : getCharOffsetLeft(txt.slice(0, -boundaryLength), regex, openChar, nonCodeRanges, startDocOffset)
}

function* codeCharMatches(
    txt: string,
    regex: string,
    startDocOffset: number,
    nonCodeRanges: NonCodeRange[],
): Generator<[match: RegExpMatchArray, offset: number], void, undefined> {
    for (const match of txt.matchAll(new RegExp(regex, 'g'))) {
        const offset = match.index ?? 0
        const docOffset = startDocOffset + offset

        if (isInsideOffsetRange(docOffset, nonCodeRanges, {excludeKinds: ['template']})) {
            continue
        }

        yield [match, offset]
    }
}

function getCharOffsetRight(
    txt: string,
    regex: string,
    open: string,
    nonCodeRanges: NonCodeRange[],
    startDocOffset: number,
): number | undefined {
    let isOpen = 0

    for (const [match, offset] of codeCharMatches(txt, regex, startDocOffset, nonCodeRanges)) {
        match[0] === open
            ? isOpen++
            : isOpen--

        if (isOpen === 0) {
            return offset
        }
    }

    return undefined
}

function getCharOffsetLeft(
    txt: string,
    regex: string,
    open: string,
    nonCodeRanges: NonCodeRange[],
    startDocOffset: number,
): number | undefined {
    const pos: number[] = []

    for (const [match, offset] of codeCharMatches(txt, regex, startDocOffset, nonCodeRanges)) {
        if (match[0] === open) {
            pos.push(offset)
        } else {
            pos.pop()
        }
    }

    return pos[pos.length - 1]
}
