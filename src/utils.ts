import * as vscode from 'vscode'

let charsList = {}
let open = []
let close = []
let languages = []

export {charsList, open, close, languages}

export function invertSelections(arr) {
    return arr.sort((a, b) => {
        if (a.start.line > b.start.line) {
            return 1
        }

        if (b.start.line > a.start.line) {
            return -1
        }

        return 0
    }).reverse()
}

export function readConfig() {
    const config = vscode.workspace.getConfiguration('autoExpandOnEnter')
    charsList = config.get('list', {})
    open = Object.keys(charsList)
    close = Object.values(charsList)
    languages = config.get('languages', [])
}
