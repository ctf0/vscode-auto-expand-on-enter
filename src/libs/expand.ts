import * as vscode from 'vscode'
import {EOL} from 'os'
import {contentExpand} from './expandString'
import {invertSelections} from '../utils'
import {createBracketSelections} from '../types/brackets'
import {getTagCharResult, createTagSelections} from '../types/tags'

export async function expandContent(languages) {
    const editor = vscode.window.activeTextEditor

    if (editor && languages.includes(editor.document.languageId)) {
        const {document, selections} = editor

        for (const selection of invertSelections(selections)) {
            if (selection.isSingleLine) {
                const {start} = selection
                let txt = document.lineAt(start.line).text
                const length = txt.length
                const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4
                const insertSpaces = editor.options.insertSpaces !== false

                txt = contentExpand(txt, tabSize, insertSpaces)

                await editor.edit(
                    (edit) => edit.replace(new vscode.Range(start.line, 0, start.line, length), txt),
                    {undoStopBefore: false, undoStopAfter: false},
                )
            }
        }

        await vscode.commands.executeCommand('cursorEnd')
    }
}

export async function expandNewLine(languages, charsList, open, close) {
    const editor = vscode.window.activeTextEditor

    if (!editor) {
        return
    }

    let {selections} = editor
    const arr = []
    const isSupported = languages.includes(editor.document.languageId)

    if (isSupported) {
        selections = invertSelections(selections)

        const tagIndents = new Map()

        for (const selection of selections) {
            const res = await createSelections(editor, selection, charsList, open, close)

            if (res) {
                if (res.tagOpeningIndent !== undefined) {
                    // key by close-tag position (explicit from tags.ts) or fall back to cursor position
                    const endKey = res._closingIndentKey ?? `${selection.end.line}:${selection.end.character}`
                    tagIndents.set(endKey, res.tagOpeningIndent)
                }

                arr.push(...res)
            }
        }

        if (arr.length) {
            const seen = new Set()
            const edits = []
            const cursorTargets = []

            const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4
            const insertSpaces = editor.options.insertSpaces !== false
            const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '\t'

            for (let i = 0; i < arr.length; i += 2) {
                const selA = arr[i]
                const selB = arr[i + 1]
                const [contentPos, closingPos] = selA.start.character <= selB.start.character
                    ? [selA.start, selB.start]
                    : [selB.start, selA.start]

                const closingKey = `${closingPos.line}:${closingPos.character}`
                const contentKey = `${contentPos.line}:${contentPos.character}`

                const lineText = editor.document.lineAt(contentPos.line).text
                const leadingWhitespace = lineText.match(/^[\t ]+/)?.[0] ?? ''

                // use the opening tag's indent (not the cursor line's) for the closing tag
                const tagIndent = tagIndents.get(closingKey) ?? leadingWhitespace

                // when cursor line is deeper than the opening tag line (multiline tags),
                // base the content indent on the opening tag's indent too
                const contentIndent = leadingWhitespace.length <= tagIndent.length
                    ? leadingWhitespace
                    : tagIndent

                if (closingKey === contentKey) {
                    // same spot e.g. <div>|</div> — combine both edits
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
                        const contentLen = closingPos.character - contentPos.character
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
                {undoStopBefore: false, undoStopAfter: false},
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

    const closingTagIndent = isSupported && selections.length === 1
        ? getClosingTagIndent(editor.document, selections[0])
        : null

    if (closingTagIndent !== null) {
        const {end} = selections[0]

        await editor.edit(
            (edit) => edit.insert(end, EOL + closingTagIndent),
            {undoStopBefore: false, undoStopAfter: false},
        )

        const line = end.line + 1
        const character = closingTagIndent.length
        editor.selections = [new vscode.Selection(line, character, line, character)]

        return
    }

    await vscode.commands.executeCommand('default:type', {text: EOL})
}

function getClosingTagIndent(document, selection) {
    const {line, character} = selection.end
    const lineText = document.lineAt(line).text
    const indent = lineText.slice(0, character)

    return !indent.trim() && /^<\/[\w:-]+/.test(lineText.slice(character)) ? indent : null
}

async function createSelections(editor, selection, charsList, open, close) {
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
