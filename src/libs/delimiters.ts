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

/* Group membership replaces the per-language regex table.
 * Check order matters: a language in more than one group (haml) gets
 * the delimiters of the group checked first. Language-specific
 * overrides are not members of any group, so they are checked between
 * the template groups and the remaining plain groups. */
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

const templateGroups: {ids: Set<string>, template: [string, string][]}[] = [
    {ids: JS_LIKE, template: [['`', '`']]},
    {ids: TEMPLATE_LIKE, template: [['{{', '}}']]},
]

const plainGroups: {ids: Set<string>, delimiters: LanguageDelimiters}[] = [
    {ids: C_LIKE, delimiters: cStyleDelimiters},
    {ids: HASH_LIKE, delimiters: hashDelimiters},
    {ids: SHELL_LIKE, delimiters: cStyleDelimiters},
]

const pythonDelimiters: LanguageDelimiters = {
    singleLineComment  : ['#'],
    multiLineComment   : [['"""', '"""'], ['\'\'\'', '\'\'\'']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const sqlDelimiters: LanguageDelimiters = {
    singleLineComment  : ['--'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['\'', '"'],
    templateDelimiters : [],
}

const luaDelimiters: LanguageDelimiters = {
    singleLineComment  : ['--'],
    multiLineComment   : [['--[[', ']]']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const markupDelimiters: LanguageDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const svelteDelimiters: LanguageDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [['<!--', '-->']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const fortranDelimiters: LanguageDelimiters = {
    singleLineComment  : ['!', 'c', 'C'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}

const languageOverrides: Record<string, LanguageDelimiters> = {
    php     : slashHashDelimiters,
    python  : pythonDelimiters,
    sql     : sqlDelimiters,
    lua     : luaDelimiters,
    svelte  : svelteDelimiters,
    fortran : fortranDelimiters,
    clojure : {singleLineComment: [';'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []},
    cobol   : {singleLineComment: ['*'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []},
}

export function getLanguageDelimiters(languageId: string): LanguageDelimiters {
    for (const {ids, template} of templateGroups) {
        if (ids.has(languageId)) {
            return {...cStyleDelimiters, templateDelimiters: template}
        }
    }

    const override = languageOverrides[languageId]

    if (override) {
        return override
    }

    for (const {ids, delimiters} of plainGroups) {
        if (ids.has(languageId)) {
            return delimiters
        }
    }

    if (MARKUP_LIKE.has(languageId)) {
        return {
            ...markupDelimiters,
            multiLineComment : HTML_COMMENT_LIKE.has(languageId) ? [['<!--', '-->']] : [],
        }
    }

    return defaultDelimiters
}
