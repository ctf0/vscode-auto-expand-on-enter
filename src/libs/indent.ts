/* Pure module (no vscode import): shared by the masked-text expander
 * (node-tested) and the editor-side selection builders. */
export function extractIndent(text: string): string {
    let i = 0

    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
        i++
    }

    return text.slice(0, i)
}
