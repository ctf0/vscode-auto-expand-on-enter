import escapeStringRegexp from 'escape-string-regexp'
import {EOL} from 'os'
import * as vscode from 'vscode'

const PACKAGE_NAME = 'autoExpandOnEnter'

let charsList = {}
let open = []
let close = []
let languages = []

export function activate(context) {
    readConfig()

    context.subscriptions.push(
        // config
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(PACKAGE_NAME)) {
                readConfig()
            }
        }),
        // content expand
        vscode.commands.registerCommand('autoExpand.content', expandContent),
        // newline expand
        vscode.commands.registerCommand('autoExpand.newLine', expandNewLine),
    )
}

async function expandContent() {
    const editor = vscode.window.activeTextEditor

    if (editor && languages.includes(editor.document.languageId)) {
        const {document, selections} = editor

        for (const selection of invertSelections(selections)) {
            if (selection.isSingleLine) {
                const {start} = selection
                let txt = document.lineAt(start.line).text
                const length = txt.length
                const match = txt.match(/^[\t ]+/)
                const space = match?.[0] ?? ''

                txt = txt
                    .replace(/\)(\.|->)/g, `)${EOL}${space}$1`) // )'.| ->'
                    .replace(/([\t ]+)?(\&{2,}|\|{2,})/g, (match) => `${match}${EOL}${space}`) // && , ||
                    .replace(/(?<=['"\S])([\t ]+)?,([\t ]+)?['"\S$]/g, (match) =>  // ',' or w,w
                        match.replace(/,[\t ]+/, `,${EOL}${space}`),
                    )

                // TODO: have to check if line has "? & :" other wise it will expand objects too
                // .replace(new RegExp(/([\t ]+)?(((?<!\?)\?(?![?:]))|((?<![?:]):(?![:])))/g), (match) => { // ? ... : ...
                //     match = match.replace(/[\t ]+/, '')

                //     return `${EOL}${space}${match}`
                // })

                await editor.edit(
                    (edit) => edit.replace(new vscode.Range(start.line, 0, start.line, length), txt),
                    {undoStopBefore: false, undoStopAfter: false},
                )
            }
        }

        vscode.commands.executeCommand('cursorEnd')
    }
}

async function expandNewLine() {
    const editor = vscode.window.activeTextEditor

    if (!editor || !languages.includes(editor.document.languageId)) {
        return
    }

    let {selections} = editor
    const arr = []
    selections = invertSelections(selections)

    for (const selection of selections) {
        const res = await createSelections(editor, selection)

        if (res) {
            arr.push(...res)
        }
    }

    if (arr.length) {
        editor.selections = arr
    }

    await vscode.commands.executeCommand('default:type', {text: EOL})

    if (arr.length && (arr.length < 3)) { // for & single selection only
        editor.selections = editor.selections.filter((value, index) => !(index % 2))
    }
}

/* Normal ------------------------------------------------------------------- */
async function createSelections(editor, selection) {
    const {end} = selection
    const {document} = editor
    const result = getCharResult(document, end)

    if (!result.hasOwnProperty('char')) {
        return false
    }

    // get open & close chars
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

    return getPositions(isRight, document, end, offset, isRight ? char.length : openChar.length, before, after)
}

function getText(isRight, document, end, len) {
    const {line, character} = end

    return isRight
        ? document.getText(document.validateRange(new vscode.Range(line, character - len, document.lineCount + 1, 0)))
        : document.getText(document.validateRange(new vscode.Range(0, 0, line, character + len)))
}

function getPositions(isRight, document, end, offset, length, before, after) {
    const pos = isRight
        ? document.positionAt(document.offsetAt(end) - length + offset)
        : document.positionAt(offset + length)

    /**
     * going right & EOL && destination is already on its own line
     * or going left && SOL
     * then remian at ur position
     */
    if (
        (isRight && !after && !document.getText(new vscode.Range(pos, pos)).trim())
        || (!isRight && !before)
    ) {
        return [new vscode.Selection(end, end)]
    }

    // return both ends
    return [
        new vscode.Selection(end, end),
        new vscode.Selection(pos, pos),
    ]
}

/* Offset --------------------------------------------------------------------- */
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

        if (isOpen == 0 && pos === undefined) {
            pos = offset
        }
    })

    return pos
}

async function getCharOffsetLeft(txt, regex, open) {
    const pos = []

    txt.replace(new RegExp(regex, 'g'), (match, offset) => {
        if (match == open) {
            pos.push(offset)
        } else {
            pos.pop()
        }
    })

    return pos[pos.length - 1]
}

/* Chars --------------------------------------------------------------------- */
function getChar(document, range, regex) {
    const match = document.getText(range).match(regex)

    return match ? match[0] : ''
}

function getCharResult(document, end) {
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

/* Util --------------------------------------------------------------------- */
function invertSelections(arr) {
    return arr.sort((a, b) => { // make sure its sorted correctly
        if (a.start.line > b.start.line) {
            return 1
        }

        if (b.start.line > a.start.line) {
            return -1
        }

        return 0
    }).reverse()
}

/* Config ------------------------------------------------------------------- */
function readConfig() {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME)

    charsList = config.get('list', {})
    open = Object.keys(charsList)
    close = Object.values(charsList)
    languages = config.get('languages', [])
}

/* --------------------------------------------------------------------- */

export function deactivate() { }
