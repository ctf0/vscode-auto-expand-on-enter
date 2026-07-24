import * as vscode from 'vscode'

export function getText(isRight, document, end, len) {
    const {line, character} = end

    return isRight
        ? document.getText(document.validateRange(new vscode.Range(line, character - len, document.lineCount + 1, 0)))
        : document.getText(document.validateRange(new vscode.Range(0, 0, line, character + len)))
}

export function getPositions(isRight, document, end, offset, length, before, after) {
    const pos = isRight
        ? document.positionAt(document.offsetAt(end) - length + offset)
        : document.positionAt(offset + length)

    if (
        (isRight && !after)
        || (!isRight && !before)
    ) {
        return [new vscode.Selection(end, end)]
    }

    return [
        new vscode.Selection(end, end),
        new vscode.Selection(pos, pos),
    ]
}
