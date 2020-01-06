const { EOL } = require('os')
const vscode = require('vscode')
const debounce = require('lodash.debounce')
const escapeStringRegexp = require('escape-string-regexp')

let config = {}
let escapedCharsList = null

async function activate() {
    await readConfig()

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('auto-expand-on-enter')) {
            await readConfig()
        }
    })

    vscode.workspace.onDidChangeTextDocument(
        debounce(async function (e) {
            let editor = vscode.window.activeTextEditor

            if (editor) {
                let { document, selections } = editor

                if (document && e.document == document) {
                    let content = e.contentChanges

                    if (content.length) {
                        let lastChange = content[content.length - 1]
                        let txt = lastChange.text

                        if (txt.startsWith(EOL) || !txt) {
                            for (let item of invertSelections(selections)) {
                                let start = item.start.line

                                await doStuff(editor, document, start == 0 ? start : start - 1)
                            }
                        }
                    }
                }
            }
        }, config.delay)
    )
}

async function doStuff(editor, doc, line) {
    let start = await doc.lineAt(line).text
    let lastChar = start.trim().match(new RegExp(`(${escapedCharsList})$`, 'g'))

    if (lastChar) {
        lastChar = lastChar[0]
        let replacement = config.chars_list[lastChar]

        if (replacement) {
            let space = start.match(/^\s+/) // get line indentation
            let nextLine = await doc.lineAt(line + 1)
            let txt = nextLine.text

            if (txt.includes(replacement)) {
                replacement = escapeStringRegexp(replacement)
                lastChar = escapeStringRegexp(lastChar)
                let moveBy = await getCharDiff(txt, lastChar, replacement)
                let replaceDone = false

                await editor.edit(
                    (edit) => {
                        edit.replace(
                            new vscode.Range(nextLine.range.start, nextLine.range.end),
                            txt.replace(new RegExp(replacement, 'g'), (match) => {
                                if (moveBy == 0 && !replaceDone) {
                                    replaceDone = true

                                    return `${EOL}${space ? space[0] : ''}${match}`
                                } else {
                                    if (!replaceDone) {
                                        moveBy--
                                    }

                                    return match
                                }
                            })
                        )
                    },
                    { undoStopBefore: false, undoStopAfter: false }
                )
            }
        }
    }

}

async function getCharDiff(start, lastChar, replacement) {
    return new Promise((resolve) => {
        let nextChar = 1
        let nextReplacementChar = 0
        let regex = `${lastChar}|${replacement}`

        // support similar chars
        // ex. `...`
        if (lastChar == replacement) {
            nextChar = 0
            regex = replacement
        }

        start.replace(new RegExp(`${regex}`, 'g'), (match) => {
            if (nextChar != nextReplacementChar) {
                match == unRegex(lastChar)
                    ? nextChar++
                    : nextReplacementChar++
            }
        })

        resolve(nextChar > 0 ? nextChar - 1 : nextChar)
    })
}

function unRegex(str) {
    return str.replace(/\\(.)/g, '$1')
}

async function readConfig() {
    config = await vscode.workspace.getConfiguration('auto-expand-on-enter')
    escapedCharsList = Object.keys(config.chars_list).map((item) => escapeStringRegexp(item)).join('|')
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
