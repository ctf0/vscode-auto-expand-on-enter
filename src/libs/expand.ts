import * as vscode from 'vscode'
import {EOL} from 'os'
import {contentExpand} from './expandString'
import {isPositionInNonCode} from './grammar'
import {extractIndent} from './indent'
import {SelectionList} from '../shared'
import {invertSelections} from '../utils'
import {createBracketSelections} from '../types/brackets'
import {getTagCharResult, createTagSelections} from '../types/tags'

export async function expandContent(languages: string[]) {
    const editor = vscode.window.activeTextEditor

    if (editor && languages.includes(editor.document.languageId)) {
        const {document, selections} = editor
        let edited = false

        for (const selection of invertSelections(selections)) {
            if (selection.isSingleLine) {
                const {start} = selection

                if (isPositionInNonCode(document, start)) {
                    continue
                }

                const txt = document.lineAt(start.line).text
                const length = txt.length
                const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4
                const insertSpaces = editor.options.insertSpaces !== false
                const expanded = contentExpand(txt, tabSize, insertSpaces, document.languageId)

                // skip no-op expansions so the document is not marked dirty
                if (expanded === txt) {
                    continue
                }

                await editor.edit(
                    (edit) => edit.replace(new vscode.Range(start.line, 0, start.line, length), expanded),
                    {undoStopBefore: false, undoStopAfter: false},
                )
                edited = true
            }
        }

        if (edited) {
            await vscode.commands.executeCommand('cursorEnd')
        }
    }
}

export async function expandNewLine(languages: string[], charsList: Record<string, string>, open: string[], close: string[]) {
    const editor = vscode.window.activeTextEditor

    if (!editor) {
        return
    }

    try {
        let {selections} = editor
        const arr: vscode.Selection[] = []
        const isSupported = languages.includes(editor.document.languageId)

        if (isSupported) {
            selections = invertSelections(selections)

            const tagIndents = new Map<string, string>()

            for (const selection of selections) {
                const res = await createSelections(editor, selection, charsList, open, close)

                if (res) {
                    if (res.tagOpeningIndent !== undefined) {
                        const endKey = res._closingIndentKey ?? `${selection.end.line}:${selection.end.character}`
                        tagIndents.set(endKey, res.tagOpeningIndent)
                    }

                    arr.push(...res)
                }
            }

            if (arr.length) {
                const seen = new Set<string>()
                const edits: {pos: vscode.Position, text: string}[] = []
                const cursorTargets: {originalLine: number, originalChar: number, col: number}[] = []

                const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4
                const insertSpaces = editor.options.insertSpaces !== false
                const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '\t'

                for (let i = 0; i < arr.length; i += 2) {
                    const selA = arr[i]
                    const selB = arr[i + 1]

                    if (!selB) {
                        break
                    }

                    const [contentPos, closingPos] = selA.start.isBeforeOrEqual(selB.start)
                        ? [selA.start, selB.start]
                        : [selB.start, selA.start]

                    const closingKey = `${closingPos.line}:${closingPos.character}`
                    const contentKey = `${contentPos.line}:${contentPos.character}`

                    const lineText = editor.document.lineAt(contentPos.line).text
                    const leadingWhitespace = extractIndent(lineText)

                    const tagIndent = tagIndents.get(closingKey) ?? leadingWhitespace

                    const contentIndent = leadingWhitespace

                    if (closingKey === contentKey) {
                        if (!seen.has(closingKey)) {
                            seen.add(closingKey)
                            edits.push({
                                pos  : contentPos,
                                text : EOL + contentIndent + indentUnit + EOL + tagIndent,
                            })
                            cursorTargets.push({
                                originalLine : contentPos.line,
                                originalChar : contentPos.character,
                                col          : contentIndent.length + indentUnit.length,
                            })
                        }
                    } else {
                        if (!seen.has(closingKey)) {
                            seen.add(closingKey)
                            edits.push({
                                pos  : closingPos,
                                text : EOL + tagIndent,
                            })
                        }

                        if (!seen.has(contentKey)) {
                            seen.add(contentKey)
                            const contentLen = contentPos.line === closingPos.line
                                ? closingPos.character - contentPos.character
                                : 0
                            edits.push({
                                pos  : contentPos,
                                text : EOL + contentIndent + indentUnit,
                            })
                            cursorTargets.push({
                                originalLine : contentPos.line,
                                originalChar : contentPos.character,
                                col          : contentIndent.length + indentUnit.length + contentLen,
                            })
                        }
                    }
                }

                edits.sort((a, b) =>
                    a.pos.line !== b.pos.line ? b.pos.line - a.pos.line : b.pos.character - a.pos.character,
                )

                await editor.edit(
                    (editBuilder) => {
                        for (const {pos, text} of edits) {
                            editBuilder.insert(pos, text)
                        }
                    },
                    {undoStopBefore: false, undoStopAfter: true},
                )

                const cursorSelections = cursorTargets.map(({originalLine, originalChar, col}) => {
                    let shift = 0

                    for (const {pos, text} of edits) {
                        if (pos.line < originalLine || (pos.line === originalLine && pos.character < originalChar)) {
                            shift += (text.match(/\n/g) || []).length
                        }
                    }

                    const line = originalLine + 1 + shift

                    return new vscode.Selection(line, col, line, col)
                })

                editor.selections = cursorSelections

                return
            }
        }

        if (isSupported && selections.length === 1) {
            const closingTagIndent = getClosingTagIndent(editor.document, selections[0])

            if (closingTagIndent !== null) {
                const {end} = selections[0]

                await editor.edit(
                    (edit) => edit.insert(end, EOL + closingTagIndent),
                    {undoStopBefore: false, undoStopAfter: true},
                )

                const line = end.line + 1
                const character = closingTagIndent.length
                editor.selections = [new vscode.Selection(line, character, line, character)]

                return
            }
        }

        await vscode.commands.executeCommand('default:type', {text: EOL})
    } catch {
        await vscode.commands.executeCommand('default:type', {text: EOL})
    }
}

function getClosingTagIndent(document: vscode.TextDocument, selection: vscode.Selection): string | null {
    const {line, character} = selection.end
    const lineText = document.lineAt(line).text
    const indent = lineText.slice(0, character)
    const after = lineText.slice(character)
    const match = after.match(/^<\/([\w:-]+)/)

    if (!indent.trim() && match) {
        const tagName = match[1]
        let scanLine = line - 1

        while (scanLine >= 0) {
            const text = document.lineAt(scanLine).text
            const ltIdx = text.indexOf('<' + tagName)

            if (ltIdx !== -1 && !text.slice(0, ltIdx).trim()) {
                return extractIndent(text)
            }

            scanLine--
        }

        return indent
    }

    return null
}

async function createSelections(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    charsList: Record<string, string>,
    open: string[],
    close: string[],
): Promise<SelectionList | false> {
    const {end} = selection
    const {document} = editor
    const {line, character} = end
    const lineText = document.lineAt(line).text
    const beforeMatch = lineText.slice(0, character).match(/(\S([\t ]+)?)$/)
    const before = beforeMatch ? beforeMatch[0] : ''
    const afterMatch = lineText.slice(character).match(/^(([\t ]+)?\S)/)
    const after = afterMatch ? afterMatch[0] : ''

    if (charsList['>'] === '<') {
        const tagResult = await getTagCharResult(document, end)

        if (tagResult) {
            return createTagSelections(editor, selection, tagResult, before, after)
        }
    }

    const bracketResult = await createBracketSelections(editor, selection, charsList, open, close)

    if (bracketResult) {
        return bracketResult
    }

    return false
}
