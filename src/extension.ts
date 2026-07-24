import * as vscode from 'vscode'
import {expandContent, expandNewLine} from './libs/expand'
import {languages, charsList, open, close, readConfig} from './utils'

const PACKAGE_NAME = 'autoExpandOnEnter'

export function activate(context) {
    readConfig()

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(PACKAGE_NAME)) {
                readConfig()
            }
        }),
        vscode.commands.registerCommand('autoExpand.content', () => expandContent(languages)),
        vscode.commands.registerCommand('autoExpand.newLine', () => expandNewLine(languages, charsList, open, close)),
    )
}

export function deactivate() {}
