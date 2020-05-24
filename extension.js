const vscode = require('vscode')
const {EOL} = require('os')
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
    context.subscriptions.push(vscode.commands.registerCommand('autoExpand.content', expandContent))

    // newline expand
    context.subscriptions.push(vscode.commands.registerCommand('autoExpand.newLine', expandNewLine))
}

async function expandContent() {
    let editor = vscode.window.activeTextEditor

    if (editor) {
        let {document, selections} = editor

        for (const selection of invertSelections(selections)) {
            if (selection.isSingleLine) {
                let {start} = selection
                let txt = document.lineAt(start.line).text
                let length = txt.length
                let match = txt.match(/^\s+/)
                let space = match ? match.join('') : ''

                txt = txt
                    .replace(new RegExp(/\)\./g), `)${EOL}${space}.`) // ).
                    .replace(new RegExp(/\)->/g), `)${EOL}${space}->`) // )->
                    .replace(new RegExp(/((?<=\S)(\s+)?,(\s+)?\S)|((?<=['"])(\s+)?,(\s+)?['"])/g), (match) => { // ',' or w,w
                        return match.replace(/,\s+/, `,${EOL}${space}`)
                    }).replace(new RegExp(/(\s+)?(((?<!\?)\?(?![?:]))|((?<![?:]):(?![:])))/g), (match) => { // ? ... : ...
                        match = match.replace(/\s+/, '')

                        return `${EOL}${space}${match}`
                    })

                await editor.edit(
                    (edit) => edit.replace(new vscode.Range(start.line, 0, start.line, length), txt),
                    {undoStopBefore: false, undoStopAfter: false}
                )
            }
        }

        vscode.commands.executeCommand('cursorEnd')
    }
}

async function expandNewLine() {
    let editor = vscode.window.activeTextEditor

    if (editor) {
        let {selections, document} = editor
        let {languageId} = document
        let arr = []
        selections = invertSelections(selections)

        for (let selection of selections) {
            let res = await createSelections(editor, selection)

            if (res) {
                arr.push(...res)
            }
        }

        if (arr.length) {
            editor.selections = arr
        } else if (config.htmlBasedLangs.includes(languageId)) {
            let res = await forHtml(editor, selections)

            if (res.length) {
                arr.push(...res)
            }

            editor.selections = arr
        }

        await addNewLine()

        if (arr.length) {
            editor.selections = editor.selections.filter((value, index) => !(index % 2))
        }
    }
}

/* Html --------------------------------------------------------------------- */
async function forHtml(editor, selections) {
    let {document} = editor
    let arr = []

    if (selections.some((selection) => checkForHtmlTag(document, selection.end))) {
        await vscode.commands.executeCommand('editor.emmet.action.balanceOut')

        for (const selection of vscode.window.activeTextEditor.selections) {
            let {start, end} = selection

            arr.push(...[
                new vscode.Selection(start, start),
                new vscode.Selection(end, end)
            ])
        }
    }

    return arr
}

function checkForHtmlTag(document, end) {
    let {line, character} = end

    let endOfLine = document.lineAt(line).text.length == character
    let before = getChar(document, new vscode.Range(line, 0, line, character), />(\s+)?$/)
    let after = getChar(document, new vscode.Range(line, character, line, document.lineAt(line).text.length), /^(\s+)?<\//)

    let bTrim = before.trim()
    let aTrim = after.trim()

    // do nothing
    if (
        (bTrim && bTrim.endsWith('>') && aTrim && aTrim.startsWith('</')) || // ></
        (bTrim && endOfLine) ||
        (bTrim && bTrim.endsWith('/>') && aTrim && aTrim.startsWith('<')) // /><
    ) {
        return false
    }

    // start or end of tags
    if (
        (bTrim && bTrim.endsWith('>')) ||
        (aTrim && aTrim.startsWith('</'))
    ) {
        return true
    }

    return false
}

/* Normal ------------------------------------------------------------------- */
async function createSelections(editor, selection) {
    let {end} = selection
    let {document} = editor
    let result = getCharResult(document, end)

    if (!result.hasOwnProperty('char')) {
        return false
    }

    // get open & close chars
    let {char, direction, before, after} = result
    let counter = charsList[char.trim()] || open.find((k) => charsList[k] === char.trim())
    let isRight = direction != 'toLeft'
    counter = isRight
        ? resolveCounter(char) + counter
        : counter + resolveCounter(char)

    let searchIn = getText(isRight, document, end, char.length)
    let offset = await getOffset(isRight, searchIn, char, counter)

    return getPositions(isRight, document, end, offset, before, after)
}

function resolveCounter(char) {
    let match = char.match(/\s+/)

    return match ? match.join('') : ''
}

function getText(isRight, document, end, len) {
    let {line, character} = end

    return isRight
        ? document.getText(document.validateRange(new vscode.Range(line, character - len, document.lineCount + 1, 0)))
        : document.getText(document.validateRange(new vscode.Range(0, 0, line, character + len)))
}

function getPositions(isRight, document, end, offset, before, after) {
    let pos = isRight
        ? document.positionAt(document.offsetAt(end) + offset - 1)
        : document.positionAt(offset + 1)

    /**
     * going right & EOL && destination is already on its own line
     * or going left && SOL
     * then remian at ur position
     */
    if (
        (isRight && !after && !document.getText(new vscode.Range(pos, pos)).trim()) ||
        (!isRight && !before)
    ) {
        return [new vscode.Selection(end, end)]
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
        : await getCharOffsetLeft(txt.slice(0, `-${char.length}`), regex, counter)
}

async function getCharOffsetRight(txt, regex, open) {
    return new Promise((resolve) => {
        let pos = 0
        let isOpen = 0

        txt.replace(new RegExp(regex, 'g'), (match, offset) => {
            match === open
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
function getChar(document, range, regex) {
    let match = document.getText(range).match(regex)

    return match ? match[0] : ''
}

function getCharResult(document, end) {
    let result = {}
    let {line, character} = end

    let before = getChar(document, new vscode.Range(line, 0, line, character), /(\S(\s+)?)$/)
    let after = getChar(document, new vscode.Range(line, character, line, document.lineAt(line).text.length), /^((\s+)?\S)/)

    let bTrim = before.trim()
    let aTrim = after.trim()

    if (aTrim && close.includes(aTrim)) {
        result = isSupported(aTrim, after)
    } else if (bTrim && open.includes(bTrim)) {
        result = isSupported(bTrim, before)
    }

    return Object.assign(result, {
        before: before,
        after: after
    })
}

function isSupported(toCompare, toUse) {
    let res = open.includes(toCompare)
        ? 'toRight'
        : close.includes(toCompare)
            ? 'toLeft'
            : false

    if (res) {
        return {
            char: toUse,
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
    return vscode.commands.executeCommand('default:type', {text: EOL})
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
