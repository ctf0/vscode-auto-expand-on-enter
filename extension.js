const { EOL } = require('os')
const vscode = require('vscode')
const debounce = require('lodash.debounce')
const escapeStringRegexp = require('escape-string-regexp')
let config

function activate() {
    readConfig()

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('auto-expand-on-enter')) {
            readConfig()
        }
    })

    vscode.workspace.onDidChangeTextDocument(
        debounce(async function (e) {
            let editor = vscode.window.activeTextEditor

            if (editor) {
                let doc = editor.document
                let selections = editor.selections

                if (doc && e.document == doc) {
                    let content = e.contentChanges
                    let lastChange = content[content.length - 1]

                    if (content.length && lastChange.text.startsWith(EOL)) {
                        if (selections.length > 1) {
                            for (let item of invertSelections(selections)) {
                                let line = item.start.line - 1

                                await doStuff(editor, doc, line)
                            }
                        } else {
                            let line = lastChange.range.start.line

                            await doStuff(editor, doc, line)
                        }
                    }
                }
            }
        }, config.delay)
    )
}

async function doStuff(editor, doc, line) {
    if (line >= 0) {
        let start = await doc.lineAt(line).text
        let lastChar = start.trim().slice(-1)
        let replacement = config.chars_list[lastChar]

        if (hasBraces(lastChar)) {
            let space = start.match(/^\s+/) || '' // get line indentation
            let regex = escapeStringRegexp(replacement) // escape char if needed
            let nextLine = await doc.lineAt(line + 1)
            let txt = nextLine.text
            if (txt.includes(replacement)) {
                let moveBy = getCharDiff(txt, lastChar, regex)
                let replaceDone = false

                await editor.edit((edit) => {
                    edit.replace(
                        new vscode.Range(nextLine.range.start, nextLine.range.end),
                        txt.replace(new RegExp(regex, 'g'), (match) => {
                            if (moveBy == 0 && !replaceDone) {
                                replaceDone = true

                                return EOL + space + match
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
    return Object.keys(config.chars_list).some((e) => e == char)
}

function readConfig() {
    config = vscode.workspace.getConfiguration('auto-expand-on-enter')
}

function invertSelections(arr) {
    return arr.sort((a, b) => { // make sure its sorted correctly
        if (a.start.line > b.start.line) return 1

        if (b.start.line > a.start.line) return -1

        return 0
    }).reverse()
}

exports.activate = activate

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
