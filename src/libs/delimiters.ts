/* Language groups share the same string/comment delimiters.
 * Set lookups replace the per-language regex table.
 * Pure module: no vscode dependency so it can be reused by
 * non-code masking (expandString) and node unit tests. */
export interface LanguageDelimiters {
    singleLineComment  : string[]
    multiLineComment   : [string, string][]
    stringDelimiters   : string[]
    templateDelimiters : [string, string][]
}

const defaultDelimiters: LanguageDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const cStyleDelimiters: LanguageDelimiters = {
    singleLineComment  : ['//'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const slashHashDelimiters: LanguageDelimiters = {
    singleLineComment  : ['//', '#'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const hashDelimiters: LanguageDelimiters = {
    singleLineComment  : ['#'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

/* Group membership replaces the /^...$|^...$/ language matching.
 * Check order matters: a language in more than one group (haml) gets
 * the delimiters of the group checked first. */
const JS_LIKE = new Set(['typescript', 'typescriptreact', 'javascript', 'javascriptreact', 'jsx', 'tsx'])
const TEMPLATE_LIKE = new Set(['blade', 'twig', 'jinja', 'handlebars', 'hbs', 'ejs', 'pug', 'jade', 'haml', 'slim', 'vue'])
const C_LIKE = new Set(['go', 'rust', 'java', 'csharp', 'cpp', 'c', 'objc', 'swift', 'kotlin', 'scala', 'dart', 'solidity', 'elm', 'erlang', 'haskell'])
const HASH_LIKE = new Set(['ruby', 'perl', 'r', 'matlab', 'elixir'])
const SHELL_LIKE = new Set(['css', 'scss', 'less', 'shellscript', 'bash', 'zsh', 'sh', 'powershell'])
const MARKUP_LIKE = new Set(['html', 'xml', 'svg', 'markdown', 'json', 'yaml', 'toml', 'ini', 'dockerfile', 'haml'])
const HTML_COMMENT_LIKE = new Set(['html', 'xml', 'svg', 'markdown'])

export function isJsLike(languageId: string): boolean {
    return JS_LIKE.has(languageId)
}

export function getLanguageDelimiters(languageId: string): LanguageDelimiters {
    if (JS_LIKE.has(languageId)) {
        return {...cStyleDelimiters, templateDelimiters: [['`', '`']]}
    }

    if (TEMPLATE_LIKE.has(languageId)) {
        return {...cStyleDelimiters, templateDelimiters: [['{{', '}}']]}
    }

    if (languageId === 'php') {
        return slashHashDelimiters
    }

    if (languageId === 'python') {
        return {
            singleLineComment  : ['#'],
            multiLineComment   : [['"""', '"""'], ['\'\'\'', '\'\'\'']],
            stringDelimiters   : ['"', '\''],
            templateDelimiters : [],
        }
    }

    if (C_LIKE.has(languageId)) {
        return cStyleDelimiters
    }

    if (HASH_LIKE.has(languageId)) {
        return hashDelimiters
    }

    if (SHELL_LIKE.has(languageId)) {
        return cStyleDelimiters
    }

    if (languageId === 'sql') {
        return {
            singleLineComment  : ['--'],
            multiLineComment   : [['/*', '*/']],
            stringDelimiters   : ['\'', '"'],
            templateDelimiters : [],
        }
    }

    if (languageId === 'lua') {
        return {
            singleLineComment  : ['--'],
            multiLineComment   : [['--[[', ']]']],
            stringDelimiters   : ['"', '\''],
            templateDelimiters : [],
        }
    }

    if (MARKUP_LIKE.has(languageId)) {
        return {
            singleLineComment : [],
            multiLineComment  : HTML_COMMENT_LIKE.has(languageId)
                ? [['<!--', '-->']]
                : [],
            stringDelimiters   : ['"', '\''],
            templateDelimiters : [],
        }
    }

    if (languageId === 'svelte') {
        return {
            singleLineComment  : [],
            multiLineComment   : [['<!--', '-->']],
            stringDelimiters   : ['"', '\''],
            templateDelimiters : [],
        }
    }

    if (languageId === 'fortran') {
        return {
            singleLineComment  : ['!', 'c', 'C'],
            multiLineComment   : [],
            stringDelimiters   : ['"', '\''],
            templateDelimiters : [],
        }
    }

    if (languageId === 'clojure') {
        return {singleLineComment: [';'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []}
    }

    if (languageId === 'cobol') {
        return {singleLineComment: ['*'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []}
    }

    return defaultDelimiters
}
