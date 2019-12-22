const vscode = require('vscode')
let charsList = {}
let cursorList = []
let delay = 0
const debounce = require('lodash.debounce')
const escapeStringRegexp = require('escape-string-regexp')

function activate() {
    readConfig()

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('auto-expand-on-enter')) {
            readConfig()
        }
    })

    vscode.window.onDidChangeTextEditorSelection((e) => {
        cursorList = e.selections

        cursorList.sort((a, b) => { // make sure its sorted correctly
            if (a.start.line > b.start.line) return 1
            if (b.start.line > a.start.line) return -1

            return 0
        }).reverse() // inverse so we can correctly track the active line
    })

    vscode.workspace.onDidChangeTextDocument(
        debounce(async function (e) {
            let editor = vscode.window.activeTextEditor
            let doc = editor.document

            if (doc) {
                let content = e.contentChanges
                let lastChange = content[content.length - 1]

                if (content.length && lastChange.text.startsWith('\n')) {
                    if (cursorList.length > 1) {
                        for (let item of cursorList) {
                            let line = item.start.line - 1

                            await doStuff(editor, doc, line)
                        }
                    } else {
                        let line = lastChange.range.start.line

                        await doStuff(editor, doc, line)
                    }
                }
            }
        }, delay)
    )
}

async function doStuff(editor, doc, line) {
    if (line >= 0) {
        let start = await doc.lineAt(line).text
        let lastChar = start.trim().slice(-1)
        let replacement = charsList[lastChar]

        if (hasBraces(lastChar)) {
            let space = start.match(/^([\s]+)/g) || '' // get line indentation
            let regex = escapeStringRegexp(replacement) // escape char if needed
            let nextLine = await doc.lineAt(line + 1)
            let txt = nextLine.text
            let moveBy = getCharDiff(txt, lastChar, regex)
            let replaceDone = false

            await editor.edit((edit) => {
                edit.replace(
                    new vscode.Range(nextLine.range.start, nextLine.range.end),
                    txt.replace(new RegExp(regex, 'g'), (match) => {
                        if (moveBy == 0 && !replaceDone) {
                            replaceDone = true

                            return '\n' + space + match
                        } else {
                            if (!replaceDone) {
                                moveBy--
                            }

                            return match
                        }
                    })
                )
            })
        }
    }
}

function getCharDiff(start, lastChar, replacement) {
    let nextChar = 1
    let nextReplacementChar = 0
    let regex = new RegExp(escapeStringRegexp(lastChar) + '|' + replacement, 'g')

    start.replace(regex, (match) => {
        if (nextChar != nextReplacementChar) {
            match == lastChar
                ? nextChar++
                : nextReplacementChar++
        }
    })

    return nextChar > 0 ? nextChar - 1 : nextChar
}

function hasBraces(char) {
    return Object.keys(charsList).some((e) => e == char)
}

function getConfig() {
    return vscode.workspace.getConfiguration('auto-expand-on-enter')
}

function readConfig() {
    let config = getConfig()

    charsList = config.chars_list
    delay = config.delay
}

exports.activate = activate

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
