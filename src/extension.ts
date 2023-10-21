import escapeStringRegexp from 'escape-string-regexp';
import { EOL } from 'os';
import * as vscode from 'vscode';

const PACKAGE_NAME = 'autoExpandOnEnter';

let config: vscode.WorkspaceConfiguration;
let charsList = {};
let open = [];
let close = [];

export function activate(context) {
    readConfig();

    context.subscriptions.push(
        // config
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(PACKAGE_NAME)) {
                readConfig();
            }
        }),
        // content expand
        vscode.commands.registerCommand('autoExpand.content', async () => await expandContent()),
        // newline expand
        vscode.commands.registerCommand('autoExpand.newLine', async () => await expandNewLine()),
    );
}

async function expandContent() {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        const { document, selections } = editor;

        for (const selection of invertSelections(selections)) {
            if (selection.isSingleLine) {
                const { start } = selection;
                let txt = document.lineAt(start.line).text;
                const length = txt.length;
                const match = txt.match(/^[\t ]+/);
                const space = match ? match.join('') : '';

                txt = txt
                    .replace(new RegExp(/\)(\.|->)/g), `)${EOL}${space}$1`) // )'.| ->'
                    .replace(new RegExp(/([\t ]+)?(\&{2,}|\|{2,})/g), (match) => `${match}${EOL}${space}`) // && , ||
                    .replace(new RegExp(/(?<=['"\S])([\t ]+)?,([\t ]+)?['"\S$]/g), (match) =>  // ',' or w,w
                        match.replace(/,[\t ]+/, `,${EOL}${space}`),
                    );

                // TODO: have to check if line has "? & :" other wise it will expand objects too
                // .replace(new RegExp(/([\t ]+)?(((?<!\?)\?(?![?:]))|((?<![?:]):(?![:])))/g), (match) => { // ? ... : ...
                //     match = match.replace(/[\t ]+/, '')

                //     return `${EOL}${space}${match}`
                // })

                await editor.edit(
                    (edit) => edit.replace(new vscode.Range(start.line, 0, start.line, length), txt),
                    { undoStopBefore: false, undoStopAfter: false },
                );
            }
        }

        vscode.commands.executeCommand('cursorEnd');
    }
}

async function expandNewLine() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        return;
    }

    let { selections, document } = editor;
    const { languageId } = document;
    const arr = [];
    let html = false;
    selections = invertSelections(selections);

    for (const selection of selections) {
        const res = await createSelections(editor, selection);

        if (res) {
            arr.push(...res);
        }
    }

    if (arr.length) {
        editor.selections = arr;
    } else if (config.htmlBasedLangs.includes(languageId)) {
        const res = await forHtml(editor, selections);

        if (res.length) {
            html = true;
            arr.push(...res);
        }

        editor.selections = arr;
    }

    await vscode.commands.executeCommand('default:type', { text: EOL });

    if (arr.length && (html || arr.length < 3)) { // for html & single selection only
        editor.selections = editor.selections.filter((value, index) => !(index % 2));
    }
}

/* Html --------------------------------------------------------------------- */
async function forHtml(editor, selections) {
    const { document } = editor;
    const arr = [];

    if (selections.some((selection) => checkForHtmlTag(document, selection.end))) {
        await vscode.commands.executeCommand('editor.emmet.action.balanceOut');

        for (const selection of vscode.window.activeTextEditor.selections) {
            const { start, end } = selection;

            arr.push(...[
                new vscode.Selection(start, start),
                new vscode.Selection(end, end),
            ]);
        }
    }

    return arr;
}

function checkForHtmlTag(document, end) {
    const { line, character } = end;

    const endOfLine = document.lineAt(line).text.length == character;
    const before = getChar(document, new vscode.Range(line, 0, line, character), /(\/)?>([\t ]+)?$/);
    const after = getChar(document, new vscode.Range(line, character, line, document.lineAt(line).text.length), /^([\t ]+)?<(\/)?/);

    const bTrim = before.trim();
    const aTrim = after.trim();

    // do nothing
    if (
        (bTrim && bTrim.endsWith('>') && aTrim && aTrim.startsWith('</')) || // ></
        (bTrim && endOfLine) ||
        (bTrim && bTrim.endsWith('/>') && aTrim && aTrim.startsWith('<')) // /><
    ) {
        return false;
    }

    // start or end of tags
    if (
        (bTrim && bTrim.endsWith('>')) ||
        (aTrim && aTrim.startsWith('</'))
    ) {
        return true;
    }

    return false;
}

/* Normal ------------------------------------------------------------------- */
async function createSelections(editor, selection) {
    const { end } = selection;
    const { document } = editor;
    const result = getCharResult(document, end);

    if (!result.hasOwnProperty('char')) {
        return false;
    }

    // get open & close chars
    const { char, direction, before, after } = result;
    let counter = charsList[char.trim()] || open.find((k) => charsList[k] === char.trim());
    const isRight = direction != 'toLeft';
    counter = isRight
        ? resolveCounter(char) + counter
        : counter + resolveCounter(char);

    const searchIn = getText(isRight, document, end, char.length);
    const offset = await getOffset(isRight, searchIn, char, counter);

    return getPositions(isRight, document, end, offset, before, after);
}

function resolveCounter(char) {
    const match = char.match(/[\t ]+/);

    return match ? match.join('') : '';
}

function getText(isRight, document, end, len) {
    const { line, character } = end;

    return isRight
        ? document.getText(document.validateRange(new vscode.Range(line, character - len, document.lineCount + 1, 0)))
        : document.getText(document.validateRange(new vscode.Range(0, 0, line, character + len)));
}

function getPositions(isRight, document, end, offset, before, after) {
    const pos = isRight
        ? document.positionAt(document.offsetAt(end) + offset - 1)
        : document.positionAt(offset + 1);

    /**
     * going right & EOL && destination is already on its own line
     * or going left && SOL
     * then remian at ur position
     */
    if (
        (isRight && !after && !document.getText(new vscode.Range(pos, pos)).trim()) ||
        (!isRight && !before)
    ) {
        return [new vscode.Selection(end, end)];
    }

    // return both ends
    return [
        new vscode.Selection(end, end),
        new vscode.Selection(pos, pos),
    ];
}

/* Offset --------------------------------------------------------------------- */
async function getOffset(isRight, txt, char, counter) {
    const regex = `${escapeStringRegexp(char)}|${escapeStringRegexp(counter)}`;

    return isRight
        ? await getCharOffsetRight(txt, regex, char)
        : await getCharOffsetLeft(txt.slice(0, `-${char.length}`), regex, counter);
}

async function getCharOffsetRight(txt, regex, open) {
    return new Promise((resolve) => {
        let pos = 0;
        let isOpen = 0;

        txt.replace(new RegExp(regex, 'g'), (match, offset) => {
            match === open
                ? isOpen++
                : isOpen--;

            if (isOpen == 0 && pos == 0) {
                pos = offset;
            }
        });

        resolve(pos);
    });
}

async function getCharOffsetLeft(txt, regex, open) {
    return new Promise((resolve) => {
        const pos = [];

        txt.replace(new RegExp(regex, 'g'), (match, offset) => {
            if (match == open) {
                pos.push(offset);
            } else {
                pos.pop();
            }
        });

        resolve(pos[pos.length - 1]);
    });
}

/* Chars --------------------------------------------------------------------- */
function getChar(document, range, regex) {
    const match = document.getText(range).match(regex);

    return match ? match[0] : '';
}

function getCharResult(document, end) {
    let result = {};
    const { line, character } = end;

    const before = getChar(document, new vscode.Range(line, 0, line, character), /(\S([\t ]+)?)$/);
    const after = getChar(document, new vscode.Range(line, character, line, document.lineAt(line).text.length), /^(([\t ]+)?\S)/);

    const bTrim = before.trim();
    const aTrim = after.trim();

    if (aTrim && close.includes(aTrim)) {
        result = isSupported(aTrim, after);
    } else if (bTrim && open.includes(bTrim)) {
        result = isSupported(bTrim, before);
    }

    return Object.assign(result, { before, after });
}

function isSupported(toCompare, toUse) {
    const res = open.includes(toCompare)
        ? 'toRight'
        : close.includes(toCompare)
            ? 'toLeft'
            : false;

    if (res) {
        return {
            char      : toUse,
            direction : res,
        };
    }

    return res;
}

/* Util --------------------------------------------------------------------- */
function invertSelections(arr) {
    return arr.sort((a, b) => { // make sure its sorted correctly
        if (a.start.line > b.start.line) return 1;

        if (b.start.line > a.start.line) return -1;

        return 0;
    }).reverse();
}

/* Config ------------------------------------------------------------------- */
function readConfig() {
    config = vscode.workspace.getConfiguration(PACKAGE_NAME);

    charsList = config.list;
    open = Object.keys(charsList);
    close = Object.values(charsList);
}

/* --------------------------------------------------------------------- */

export function deactivate() { }
