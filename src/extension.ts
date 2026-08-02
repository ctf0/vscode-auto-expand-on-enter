import * as vscode from 'vscode'
import {expandContent, expandNewLine} from './libs/expand'
import {getLanguages, getCharsList, getOpen, getClose, readConfig} from './utils'

const PACKAGE_NAME = 'autoExpandOnEnter'

export function activate(context: vscode.ExtensionContext) {
    readConfig()

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(PACKAGE_NAME)) {
                readConfig()
            }
        }),
        vscode.commands.registerCommand('autoExpand.content', () => expandContent(getLanguages())),
        vscode.commands.registerCommand('autoExpand.newLine', () => expandNewLine(getLanguages(), getCharsList(), getOpen(), getClose())),
    )
}

export function deactivate() {}
