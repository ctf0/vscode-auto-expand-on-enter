const vscode = require('vscode')
let charsList = {}
let cursorList = []
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
        }, 50)
    )
}

async function doStuff(editor, doc, line) {
    let start = await doc.lineAt(line).text
    let lastChar = start.trim().slice(-1)

    if (hasBraces(lastChar)) {
        let space = start.match(/^([\s]+)/g) || '' // get line indentation
        let regex = escapeStringRegexp(charsList[lastChar]) // escape char if needed
        let nextLine = await doc.lineAt(line + 1)
        let txt = nextLine.text

        await editor.edit((edit) => {
            edit.replace(
                new vscode.Range(nextLine.range.start, nextLine.range.end),
                txt.replace(
                    new RegExp(`${regex}(?!.*${regex})`, 'g'), // get last occurrence
                    (match) => ('\n' + space + match)
                )
            )
        })
    }
}

function hasBraces(char) {
    return Object.keys(charsList).some((e) => e == char)
}

function getConfig() {
    return vscode.workspace.getConfiguration('auto-expand-on-enter')
}

function readConfig() {
    charsList = getConfig().chars_list
}

exports.activate = activate

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
