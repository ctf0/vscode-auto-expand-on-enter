import escapeStringRegexp from 'escape-string-regexp'
import * as vscode from 'vscode'
import {getText, getPositions} from '../shared'

export async function createBracketSelections(editor, selection, charsList, open, close) {
    const {end} = selection
    const {document} = editor
    const result = getCharResult(document, end, open, close)

    if (!Object.hasOwn(result, 'char')) {
        return false
    }

    const {char, direction, before, after} = result
    const isRight = direction !== 'toLeft'
    const openChar = isRight ? char.trim() : open.find((key) => charsList[key] === char.trim())
    const closeChar = isRight ? charsList[openChar] : char.trim()

    if (!openChar || !closeChar) {
        return false
    }

    const searchIn = getText(isRight, document, end, char.length)
    const offset = await getOffset(isRight, searchIn, openChar, closeChar, char.length)

    if (offset === undefined) {
        return false
    }

    const positions = getPositions(isRight, document, end, offset, isRight ? char.length : openChar.length, before, after)

    if (positions.length < 2 || !hasContentAroundPair(document, end, char, openChar, closeChar, positions, isRight)) {
        return false
    }

    // when the bracket pair is <>, the close char > belongs to an HTML tag
    // — attach the opening tag's first-line indent so the edit loop can use it
    if (openChar === '>' && closeChar === '<') {
        const tagDocOffset = document.offsetAt(end) - char.length + offset
        const tagLine = document.positionAt(tagDocOffset).line
        const tagLineText = document.lineAt(tagLine).text
        positions.tagOpeningIndent = tagLineText.match(/^[\t ]+/)?.[0] ?? ''
    }

    return positions
}

function hasContentAroundPair(document, end, char, openChar, closeChar, positions, isRight) {
    const openOffset = isRight
        ? document.offsetAt(end) - char.length
        : document.offsetAt(positions[1].start) - openChar.length
    const closeOffset = isRight
        ? document.offsetAt(positions[1].start)
        : document.offsetAt(end) + char.length - closeChar.length
    const openPosition = document.positionAt(openOffset)
    const closePosition = document.positionAt(closeOffset)
    const beforeOpen = document.lineAt(openPosition.line).text.slice(0, openPosition.character)
    const afterClose = document.lineAt(closePosition.line).text.slice(closePosition.character + closeChar.length)

    return beforeOpen.trim() && afterClose.trim()
}

/* Chars ------------------------------------------------------------------- */
function getChar(document, range, regex) {
    const match = document.getText(range).match(regex)

    return match ? match[0] : ''
}

function getCharResult(document, end, open, close) {
    let result = {}
    const {line, character} = end
    const lineText = document.lineAt(line).text

    const before = getChar(document, new vscode.Range(line, 0, line, character), /(\S([\t ]+)?)$/)
    const after = getChar(document, new vscode.Range(line, character, line, lineText.length), /^(([\t ]+)?\S)/)
    const openBefore = getConfiguredChar(lineText.slice(0, character), open, true)
    const closeAfter = getConfiguredChar(lineText.slice(character), close, false)

    if (closeAfter) {
        result = {char: closeAfter, direction: 'toLeft'}
    } else if (openBefore) {
        result = {char: openBefore, direction: 'toRight'}
    }

    return Object.assign(result, {before, after})
}

function getConfiguredChar(text, chars, fromEnd) {
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
async function getOffset(isRight, txt, openChar, closeChar, boundaryLength) {
    const regex = `${escapeStringRegexp(openChar)}|${escapeStringRegexp(closeChar)}`

    return isRight
        ? await getCharOffsetRight(txt, regex, openChar)
        : await getCharOffsetLeft(txt.slice(0, -boundaryLength), regex, openChar)
}

async function getCharOffsetRight(txt, regex, open) {
    let pos
    let isOpen = 0

    txt.replace(new RegExp(regex, 'g'), (match, offset) => {
        match === open
            ? isOpen++
            : isOpen--

        if (isOpen === 0 && pos === undefined) {
            pos = offset
        }
    })

    return pos
}

async function getCharOffsetLeft(txt, regex, open) {
    const pos = []

    txt.replace(new RegExp(regex, 'g'), (match, offset) => {
        if (match === open) {
            pos.push(offset)
        } else {
            pos.pop()
        }
    })

    return pos[pos.length - 1]
}
