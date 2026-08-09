import * as vscode from 'vscode'

export interface SelectionList extends Array<vscode.Selection> {
    tagOpeningIndent?  : string
    _closingIndentKey? : string
}

export function getText(direction: 'toLeft' | 'toRight', document: vscode.TextDocument, position: vscode.Position, length: number): string {
    const {line, character} = position

    return direction === 'toRight'
        ? document.getText(document.validateRange(new vscode.Range(line, Math.max(0, character - length), document.lineCount + 1, 0)))
        : document.getText(document.validateRange(new vscode.Range(0, 0, line, character + length)))
}

export function getPositions(
    direction: 'toLeft' | 'toRight',
    document: vscode.TextDocument,
    position: vscode.Position,
    offset: number,
    length: number,
    hasContentBefore: string,
    hasContentAfter: string,
): vscode.Selection[] {
    const pos = direction === 'toRight'
        ? document.positionAt(document.offsetAt(position) - length + offset)
        : document.positionAt(offset + length)

    if (
        (direction === 'toRight' && !hasContentAfter)
        || (direction === 'toLeft' && !hasContentBefore)
    ) {
        return [new vscode.Selection(position, position)]
    }

    return [
        new vscode.Selection(position, position),
        new vscode.Selection(pos, pos),
    ]
}
