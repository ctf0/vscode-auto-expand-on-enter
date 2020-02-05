const vscode = require('vscode')
const { EOL } = require('os')
const escapeStringRegexp = require('escape-string-regexp')
let config = {}
let charsList = {}
let open = []
let close = []

async function activate(context) {
    await readConfig()

    // config
    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('auto-expand-on-enter')) {
            await readConfig()
        }
    })

    // content expand
    context.subscriptions.push(
        vscode.commands.registerCommand('autoExpand.content', async () => {
            let editor = vscode.window.activeTextEditor

            if (editor) {
                let { document, selections } = editor

                for (const selection of invertSelections(selections)) {
                    if (selection.isSingleLine) {
                        let { start } = selection
                        let txt = document.lineAt(start.line).text
                        let length = txt.length
                        let match = txt.match(/^\s+/)
                        let space = match && match.length ? match[0] : ''

                        // method chain
                        txt = txt.replace(new RegExp(/\)\./g), `)${EOL}${space}.`)
                        // args
                        txt = txt.replace(new RegExp(/(?<=['"])(\s+)?,(\s+)?['"]/g), (match) => {
                            return match.replace(/,\s+/, `,${EOL}${space}`)
                        })

                        await editor.edit(
                            (edit) => edit.replace(new vscode.Range(start.line, 0, start.line, length), txt),
                            { undoStopBefore: false, undoStopAfter: false }
                        )
                    }
                }

                vscode.commands.executeCommand('cursorEnd')
            }
        })
    )

    // newline expand
    context.subscriptions.push(
        vscode.commands.registerCommand('autoExpand.newLine', async () => {
            let editor = vscode.window.activeTextEditor

            if (editor) {
                let { selections } = editor
                let arr = []

                for (let selection of invertSelections(selections)) {
                    let res = await createSelections(editor, selection)

                    if (res) {
                        arr.push(...res)
                    }
                }

                if (arr.length) {
                    editor.selections = arr
                }

                await addNewLine()
                editor.selections = editor.selections.filter((value, index) => !(index % 2))
            }
        })
    )
}

async function createSelections(editor, selection) {
    let { end } = selection
    let { document } = editor
    let result = getCharResult(document, end)

    if (!result.char) {
        return false
    }

    // get open & close chars
    let { char, direction, before, after } = result
    let counter = charsList[char] || open.find((k) => charsList[k] === char)
    let isRight = direction != 'toLeft'

    let searchIn = getText(isRight, document, end)
    let offset = await getOffset(isRight, searchIn, char, counter)

    return getPositions(isRight, document, end, offset, before, after)
}

/* --------------------------------------------------------------------- */
function getText(isRight, document, end) {
    let { line, character } = end

    return isRight
        ? document.getText(document.validateRange(new vscode.Range(line, character - 1, document.lineCount + 1, 0)))
        : document.getText(document.validateRange(new vscode.Range(0, 0, line, character + 1)))
}

function getPositions(isRight, document, end, offset, before, after) {
    let pos = isRight
        ? document.positionAt(document.offsetAt(end) + offset - 1)
        : document.positionAt(offset + 1)

    /**
     * going right & EOL && destination is already on its own line
     * then remian at ur position
     */
    if (isRight && !after && !document.getText(new vscode.Range(pos, pos)).trim()) {
        return [new vscode.Selection(end, end)]
    }

    /**
     * going left && SOL
     * then go to the other end
     */
    if (!isRight && !before) {
        return [new vscode.Selection(pos, pos)]
    }

    // return both ends
    return [
        new vscode.Selection(end, end),
        new vscode.Selection(pos, pos)
    ]
}

/* Offset --------------------------------------------------------------------- */
async function getOffset(isRight, txt, char, counter) {
    let regex = `${escapeStringRegexp(char)}|${escapeStringRegexp(counter)}`

    return isRight
        ? await getCharOffsetRight(txt, regex, char)
        : await getCharOffsetLeft(txt.slice(0, -1), regex, counter)
}

async function getCharOffsetRight(txt, regex, open) {
    return new Promise((resolve) => {
        let pos = 0
        let isOpen = 0

        txt.replace(new RegExp(regex, 'g'), (match, offset) => {
            match == open
                ? isOpen++
                : isOpen--

            if (isOpen == 0 && pos == 0) {
                pos = offset
            }
        })

        resolve(pos)
    })
}

async function getCharOffsetLeft(txt, regex, open) {
    return new Promise((resolve) => {
        let pos = []

        txt.replace(new RegExp(regex, 'g'), (match, offset) => {
            if (match == open) {
                pos.push(offset)
            } else {
                pos.pop()
            }
        })

        resolve(pos[pos.length - 1])
    })
}

/* Chars --------------------------------------------------------------------- */
function getCharResult(document, end) {
    let result = {}
    let { line, character } = end

    let before = document.getText(
        document.validateRange(new vscode.Range(end, end.with(line, character > 0 ? character - 1 : character)))
    )
    let after = document.getText(
        document.validateRange(new vscode.Range(end, end.with(line, character + 1)))
    )

    if (after && close.includes(after)) {
        result = isSupported(after)
    } else if (before && open.includes(before)) {
        result = isSupported(before)
    }

    return Object.assign({}, result, {
        before: before,
        after: after
    })
}

function isSupported(char) {
    let res = open.includes(char)
        ? 'toRight'
        : close.includes(char)
            ? 'toLeft'
            : false

    if (res) {
        return {
            char: char,
            direction: res
        }
    }

    return res
}

/* Util --------------------------------------------------------------------- */
function invertSelections(arr) {
    return arr.sort((a, b) => { // make sure its sorted correctly
        if (a.start.line > b.start.line) return 1
        if (b.start.line > a.start.line) return -1

        return 0
    }).reverse()
}

async function addNewLine() {
    return vscode.commands.executeCommand('default:type', { text: EOL })
}

/* Config ------------------------------------------------------------------- */
async function readConfig() {
    config = await vscode.workspace.getConfiguration('auto-expand-on-enter')

    charsList = config.list
    open = Object.keys(charsList)
    close = Object.values(charsList)
}

/* --------------------------------------------------------------------- */

exports.activate = activate

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
