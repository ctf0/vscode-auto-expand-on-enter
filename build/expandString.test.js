'use strict'
var __create = Object.create
var __defProp = Object.defineProperty
var __getOwnPropDesc = Object.getOwnPropertyDescriptor
var __getOwnPropNames = Object.getOwnPropertyNames
var __getProtoOf = Object.getPrototypeOf
var __hasOwnProp = Object.prototype.hasOwnProperty

var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === 'object' || typeof from === 'function') {
        for (let key of __getOwnPropNames(from)) {
            if (!__hasOwnProp.call(to, key) && key !== except) {
                __defProp(to, key, {get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable})
            }
        }
    }

    return to
}

var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, 'default', {value: mod, enumerable: true}) : target,
    mod,
))

// src/libs/expandString.test.ts
var import_node_test = __toESM(require('node:test'))
var import_strict = __toESM(require('node:assert/strict'))

// src/libs/expandString.ts
var import_os = require('os')

// src/libs/delimiters.ts
var defaultDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var cStyleDelimiters = {
    singleLineComment  : ['//'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var slashHashDelimiters = {
    singleLineComment  : ['//', '#'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var hashDelimiters = {
    singleLineComment  : ['#'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var JS_LIKE = /* @__PURE__ */ new Set(['typescript', 'typescriptreact', 'javascript', 'javascriptreact', 'jsx', 'tsx'])
var TEMPLATE_LIKE = /* @__PURE__ */ new Set(['blade', 'twig', 'jinja', 'handlebars', 'hbs', 'ejs', 'pug', 'jade', 'haml', 'slim', 'vue'])
var C_LIKE = /* @__PURE__ */ new Set(['go', 'rust', 'java', 'csharp', 'cpp', 'c', 'objc', 'swift', 'kotlin', 'scala', 'dart', 'solidity', 'elm', 'erlang', 'haskell'])
var HASH_LIKE = /* @__PURE__ */ new Set(['ruby', 'perl', 'r', 'matlab', 'elixir'])
var SHELL_LIKE = /* @__PURE__ */ new Set(['css', 'scss', 'less', 'shellscript', 'bash', 'zsh', 'sh', 'powershell'])
var MARKUP_LIKE = /* @__PURE__ */ new Set(['html', 'xml', 'svg', 'markdown', 'json', 'yaml', 'toml', 'ini', 'dockerfile', 'haml'])
var HTML_COMMENT_LIKE = /* @__PURE__ */ new Set(['html', 'xml', 'svg', 'markdown'])

function isJsLike(languageId) {
    return JS_LIKE.has(languageId)
}

var templateGroups = [
    {ids: JS_LIKE, template: [['`', '`']]},
    {ids: TEMPLATE_LIKE, template: [['{{', '}}']]},
]
var plainGroups = [
    {ids: C_LIKE, delimiters: cStyleDelimiters},
    {ids: HASH_LIKE, delimiters: hashDelimiters},
    {ids: SHELL_LIKE, delimiters: cStyleDelimiters},
]
var pythonDelimiters = {
    singleLineComment  : ['#'],
    multiLineComment   : [['"""', '"""'], ['\'\'\'', '\'\'\'']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var sqlDelimiters = {
    singleLineComment  : ['--'],
    multiLineComment   : [['/*', '*/']],
    stringDelimiters   : ['\'', '"'],
    templateDelimiters : [],
}
var luaDelimiters = {
    singleLineComment  : ['--'],
    multiLineComment   : [['--[[', ']]']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var markupDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var svelteDelimiters = {
    singleLineComment  : [],
    multiLineComment   : [['<!--', '-->']],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var fortranDelimiters = {
    singleLineComment  : ['!', 'c', 'C'],
    multiLineComment   : [],
    stringDelimiters   : ['"', '\''],
    templateDelimiters : [],
}
var languageOverrides = {
    php     : slashHashDelimiters,
    python  : pythonDelimiters,
    sql     : sqlDelimiters,
    lua     : luaDelimiters,
    svelte  : svelteDelimiters,
    fortran : fortranDelimiters,
    clojure : {singleLineComment: [';'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []},
    cobol   : {singleLineComment: ['*'], multiLineComment: [], stringDelimiters: ['"', '\''], templateDelimiters: []},
}

function getLanguageDelimiters(languageId) {
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

// src/libs/nonCode.ts
function isInsideOffsetRange(offset, ranges, opts) {
    const exclude = new Set(opts?.excludeKinds ?? [])

    for (const r of ranges) {
        if (exclude.has(r.kind)) {
            continue
        }

        if (offset >= r.startOffset && offset < r.endOffset) {
            return true
        }
    }

    return false
}

// src/libs/literal.ts
var PLACEHOLDER_OPEN = '\0L'
var PLACEHOLDER_CLOSE = '\0'

function placeholder(index) {
    return `${PLACEHOLDER_OPEN}${index}${PLACEHOLDER_CLOSE}`
}

function maskLiterals(text, languageId) {
    const config = getLanguageDelimiters(languageId ?? '')
    const ranges = []
    scanDelimited(text, config.templateDelimiters, 'template', ranges)

    for (const delim of config.stringDelimiters) {
        if (delim) {
            scanStrings(text, delim, 'string', ranges)
        }
    }

    scanDelimited(text, config.multiLineComment, 'comment', ranges)
    scanSingleLineComments(text, config.singleLineComment, ranges)

    if (languageId && isJsLike(languageId)) {
        scanRegexLiterals(text, ranges)
    }

    ranges.sort((a, b) => a.startOffset - b.startOffset)
    const ordered = []
    let lastEnd = -1

    for (const r of ranges) {
        if (r.startOffset < lastEnd) {
            continue
        }

        ordered.push(r)
        lastEnd = r.endOffset
    }

    return {masked: buildMasked(text, ordered), literals: ordered}
}

function restoreLiterals(masked, literals) {
    let out = masked

    for (let i = 0; i < literals.length; i++) {
        out = out.split(placeholder(i)).join(literals[i].value)
    }

    return out
}

function buildMasked(text, ranges) {
    if (ranges.length === 0) {
        return text
    }

    let out = ''
    let cursor = 0

    for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i]
        out += text.slice(cursor, r.startOffset) + placeholder(i)
        cursor = r.endOffset
    }

    out += text.slice(cursor)

    return out
}

function scanDelimited(text, pairs, kind, ranges) {
    for (const [open, close] of pairs) {
        let i = 0

        while ((i = text.indexOf(open, i)) !== -1) {
            if (isInsideOffsetRange(i, ranges)) {
                i++
                continue
            }

            const closeIdx = text.indexOf(close, i + open.length)

            if (closeIdx === -1) {
                break
            }

            const end = closeIdx + close.length
            ranges.push({startOffset: i, endOffset: end, kind, value: text.slice(i, end)})
            i = end
        }
    }
}

function scanStrings(text, delim, kind, ranges) {
    let i = 0

    while ((i = text.indexOf(delim, i)) !== -1) {
        if (isInsideOffsetRange(i, ranges)) {
            i++
            continue
        }

        let j = i + 1

        while (j < text.length && text[j] !== delim) {
            if (text[j] === '\\') {
                j += 2
            } else {
                j++
            }
        }

        if (j >= text.length) {
            i++
            continue
        }

        const end = j + 1
        ranges.push({startOffset: i, endOffset: end, kind, value: text.slice(i, end)})
        i = end
    }
}

function scanSingleLineComments(text, markers, ranges) {
    for (const marker of markers) {
        let i = 0

        while ((i = text.indexOf(marker, i)) !== -1) {
            if (!isInsideOffsetRange(i, ranges)) {
                const lineEnd = text.indexOf('\n', i)
                const end = lineEnd === -1 ? text.length : lineEnd
                ranges.push({startOffset: i, endOffset: end, kind: 'comment', value: text.slice(i, end)})
            }

            i++
        }
    }
}

var IDENTIFIER_CHARS = new Set(`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$)]}.'"\``)

function isIdentifierChar(c) {
    return IDENTIFIER_CHARS.has(c)
}

function isAsciiLetter(c) {
    const code = c.charCodeAt(0)

    return code >= 65 && code <= 90 || code >= 97 && code <= 122
}

function scanRegexLiterals(text, ranges) {
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== '/' || isInsideOffsetRange(i, ranges)) {
            continue
        }

        const prev = i === 0 ? '' : text[i - 1]

        if (prev !== '' && isIdentifierChar(prev)) {
            continue
        }

        let j = i + 1
        let inClass = false

        while (j < text.length) {
            const c = text[j]

            if (c === '\\') {
                j += 2
                continue
            }

            if (c === '[') {
                inClass = true
                j++
                continue
            }

            if (c === ']' && inClass) {
                inClass = false
                j++
                continue
            }

            if (c === '/' && !inClass) {
                let k = j + 1

                while (k < text.length && isAsciiLetter(text[k])) {
                    k++
                }

                ranges.push({startOffset: i, endOffset: k, kind: 'string', value: text.slice(i, k)})
                i = k
                break
            }

            if (c === '\n') {
                break
            }

            j++
        }
    }
}

// src/libs/indent.ts
function extractIndent(text) {
    let i = 0

    while (i < text.length && (text[i] === ' ' || text[i] === '	')) {
        i++
    }

    return text.slice(0, i)
}

// src/libs/expandString.ts
function expandChainOperators(txt, indentUnit, chainIndent) {
    let chainIndex = 0

    return txt.replace(/\s*(->|\?\.|\.(?!\d))/g, (match, operator, offset, str) => {
        const prefix = str.slice(0, offset)
        let parenDepth = 0

        for (let i = 0; i < prefix.length; i++) {
            if (prefix[i] === '(') {
                parenDepth++
            } else if (prefix[i] === ')') {
                parenDepth--
            }
        }

        if (parenDepth > 0) {
            return match
        }

        if (str[offset - 1] === '.' || str[offset + operator.length] === '.') {
            return match
        }

        const beforeOp = str.slice(0, offset).trimEnd()

        if (/\$\w+$/.test(beforeOp)) {
            return match
        }

        chainIndex++

        return offset === 0 ? match : `${import_os.EOL}${chainIndent}${operator}`
    })
}

function expandBooleanOperators(txt, chainIndent) {
    return txt.replace(/([\t ]+)?(\&{2,}|\|{2,})([\t ]+)?/g, (match) => `${match.trimEnd()}${import_os.EOL}${chainIndent}`)
}

function expandTernaryOperators(txt, chainIndent) {
    return txt.replace(/(?<=\S)([\t ]+)\?([\t ]+)/g, (_match, _pre, post) => `${import_os.EOL}${chainIndent}?${post}`).replace(/(?<=\S)([\t ]+):([\t ]+)/g, (_match, _pre, post) => `${import_os.EOL}${chainIndent}:${post}`)
}

function expandArrayElements(txt, indentUnit) {
    let result = ''
    let i = 0

    while (i < txt.length) {
        const open = txt.indexOf('[', i)

        if (open === -1) {
            result += txt.slice(i)
            break
        }

        result += txt.slice(i, open)
        let depth = 0
        let j = open

        while (j < txt.length) {
            if (txt[j] === '[') {
                depth++
            } else if (txt[j] === ']') {
                depth--

                if (depth === 0) {
                    break
                }
            }

            j++
        }

        if (j >= txt.length) {
            result += txt.slice(open)
            break
        }

        const inner = txt.slice(open + 1, j)
        const elements = splitTopLevel(inner, ',')

        if (elements.length <= 1) {
            result += txt.slice(open, j + 1)
        } else {
            const lineStart = txt.lastIndexOf('\n', open) + 1
            const linePrefix = txt.slice(lineStart, open)
            const containingLineIndent = extractIndent(linePrefix)
            const elementIndent = containingLineIndent + indentUnit
            result += `[
${elementIndent}${elements.join(`,
${elementIndent}`)}
${containingLineIndent}]`
        }

        i = j + 1
    }

    return result
}

function splitTopLevel(text, separator) {
    const parts = []
    let depth = 0
    let start = 0

    for (let i = 0; i < text.length; i++) {
        const c = text[i]

        if (c === '[' || c === '(' || c === '{') {
            depth++
        } else if (c === ']' || c === ')' || c === '}') {
            depth--
        } else if (c === separator && depth === 0) {
            parts.push(text.slice(start, i).trim())
            start = i + 1
        }
    }

    parts.push(text.slice(start).trim())

    return parts.filter((part) => part !== '')
}

function expandFunctionArguments(txt, indentUnit) {
    return formatCallGroups(txt, indentUnit)
}

function formatCallGroups(txt, indentUnit) {
    let out = ''
    let i = 0
    let arrayDepth = 0
    let braceDepth = 0

    while (i < txt.length) {
        const c = txt[i]

        if (c === '[') {
            arrayDepth++
        } else if (c === ']') {
            arrayDepth = Math.max(0, arrayDepth - 1)
        } else if (c === '{') {
            braceDepth++
        } else if (c === '}') {
            braceDepth = Math.max(0, braceDepth - 1)
        }

        if (arrayDepth > 0 || c !== '(') {
            if (c === ',' && arrayDepth === 0 && !isCommaGuard(txt, i)) {
                const lineStart2 = txt.lastIndexOf('\n', i) + 1
                const lineIndent = extractIndent(txt.slice(lineStart2, i))
                const indent = braceDepth > 0 ? lineIndent + indentUnit : lineIndent
                out += ',' + import_os.EOL + indent
                i++

                while (i < txt.length && (txt[i] === ' ' || txt[i] === '	')) {
                    i++
                }

                continue
            }

            out += c
            i++
            continue
        }

        const close = findMatchingParen(txt, i)

        if (close === -1) {
            out += txt.slice(i)
            break
        }

        const inner = txt.slice(i + 1, close)
        const lineStart = txt.lastIndexOf('\n', i) + 1
        const baseIndent = extractIndent(txt.slice(lineStart, i))

        if (!needsBreak(inner)) {
            out += '(' + formatCallGroups(inner, indentUnit) + ')'
        } else {
            const parts = splitCallParts(inner)
            const contentIndent = baseIndent + indentUnit
            out += '('

            for (let p = 0; p < parts.length; p++) {
                out += (p > 0 ? ',' : '') + import_os.EOL + pushPart(formatCallGroups(parts[p], indentUnit), contentIndent)
            }

            out += import_os.EOL + baseIndent + ')'
        }

        i = close + 1
    }

    return out
}

function findMatchingParen(text, open) {
    let depth = 0

    for (let j = open; j < text.length; j++) {
        if (text[j] === '(') {
            depth++
        } else if (text[j] === ')') {
            depth--

            if (depth === 0) {
                return j
            }
        }
    }

    return -1
}

function needsBreak(inner) {
    let arrayDepth = 0

    for (let i = 0; i < inner.length; i++) {
        const c = inner[i]

        if (c === '[') {
            arrayDepth++
        } else if (c === ']') {
            arrayDepth = Math.max(0, arrayDepth - 1)
        } else if (arrayDepth === 0) {
            if (c === '\n') {
                return true
            }

            if (c === ',' && !isCommaGuard(inner, i)) {
                return true
            }

            if (c === '(') {
                const close = findMatchingParen(inner, i)

                if (close !== -1) {
                    if (needsBreak(inner.slice(i + 1, close))) {
                        return true
                    }

                    i = close
                }
            }
        }
    }

    return false
}

function isCommaGuard(text, commaIndex) {
    let j = commaIndex + 1

    while (j < text.length && (text[j] === ' ' || text[j] === '	')) {
        j++
    }

    return j >= text.length || text[j] === ')' || text[j] === ']' || text[j] === '}' || text[j] === '[' || text[j] === '\n' || text[j] === '\r'
}

function splitCallParts(inner) {
    const parts = []
    let depth = 0
    let start = 0

    for (let i = 0; i < inner.length; i++) {
        const c = inner[i]

        if (c === '(' || c === '[' || c === '{') {
            depth++
        } else if (c === ')' || c === ']' || c === '}') {
            depth = Math.max(0, depth - 1)
        } else if (c === ',' && depth === 0 && !isCommaGuard(inner, i)) {
            parts.push(inner.slice(start, i).trim())
            start = i + 1
        }
    }

    parts.push(inner.slice(start).trim())

    return parts.filter((part) => part !== '')
}

function pushPart(part, indent) {
    const lines = part.split('\n')
    const first = lines[0] ?? ''
    const anchor = extractIndent(first)
    let out = indent + first
    let parenDepth = 0
    let arrayDepth = 0

    for (const c of first) {
        if (c === '(') {
            parenDepth++
        } else if (c === ')') {
            parenDepth = Math.max(0, parenDepth - 1)
        } else if (c === '[') {
            arrayDepth++
        } else if (c === ']') {
            arrayDepth = Math.max(0, arrayDepth - 1)
        }
    }

    for (let k = 1; k < lines.length; k++) {
        const line = lines[k]
        const origIndent = extractIndent(line)
        const indentToUse = parenDepth > 0 || arrayDepth > 0 ? indent + origIndent.slice(anchor.length) : indent
        out += import_os.EOL + indentToUse + line.slice(origIndent.length)

        for (const c of line) {
            if (c === '(') {
                parenDepth++
            } else if (c === ')') {
                parenDepth = Math.max(0, parenDepth - 1)
            } else if (c === '[') {
                arrayDepth++
            } else if (c === ']') {
                arrayDepth = Math.max(0, arrayDepth - 1)
            }
        }
    }

    return out
}

function contentExpand(txt, tabSize, insertSpaces, languageId) {
    const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '	'
    const space = extractIndent(txt)
    const chainIndent = space + indentUnit
    const {masked, literals} = maskLiterals(txt, languageId)
    let result = masked
    result = expandChainOperators(result, indentUnit, chainIndent)
    result = expandBooleanOperators(result, chainIndent)
    result = expandTernaryOperators(result, chainIndent)
    result = expandArrayElements(result, indentUnit)
    result = expandFunctionArguments(result, indentUnit)

    return restoreLiterals(result, literals)
}

// src/libs/expandString.test.ts
var TAB = '    ';
(0, import_node_test.default)('expandContent: single-line array expands with correct indentation (no chain)', () => {
    const input = 'foo([a, b])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo([
${TAB}a,
${TAB}b
])`)
});
(0, import_node_test.default)('expandContent: single-line array with leading indent uses chainIndent', () => {
    const input = '    foo([a, b])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    foo([
${TAB}${TAB}a,
${TAB}${TAB}b
${TAB}])`)
});
(0, import_node_test.default)('expandContent: array with single element is not expanded', () => {
    const input = 'foo([a])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo([a])')
});
(0, import_node_test.default)('expandContent: chain method with array where closing bracket aligns at chain level', () => {
    const input = 'foo()->bar([a, b, c])->baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo()
${TAB}->bar([
${TAB}${TAB}a,
${TAB}${TAB}b,
${TAB}${TAB}c
${TAB}])
${TAB}->baz()`)
});
(0, import_node_test.default)('expandContent: indented line with chain and array uses chainIndent for alignment', () => {
    const input = '    foo()->bar([a, b])->baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    foo()
${TAB}${TAB}->bar([
${TAB}${TAB}${TAB}a,
${TAB}${TAB}${TAB}b
${TAB}${TAB}])
${TAB}${TAB}->baz()`)
});
(0, import_node_test.default)('expandContent: PHP-style chain with whereIn array uses chainIndent for alignment', () => {
    const input = '$roles = Role::query()->whereIn(\'name\', [DashboardConstants::ROUTE_PARAM, ProfileConstants::ROUTE_PARAM])->get()->merge($authModel->roles)->unique();'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `$roles = Role::query()
    ->whereIn('name', [
        DashboardConstants::ROUTE_PARAM,
        ProfileConstants::ROUTE_PARAM
    ])
    ->get()
    ->merge($authModel->roles)
    ->unique();`)
});
(0, import_node_test.default)('expandContent: chain expansion for -> operators', () => {
    const input = 'foo()->bar()->baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo()
${TAB}->bar()
${TAB}->baz()`)
});
(0, import_node_test.default)('expandContent: dot-chained calls expand like arrow chains', () => {
    const input = 'foo().bar().baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo()
${TAB}.bar()
${TAB}.baz()`)
});
(0, import_node_test.default)('expandContent: $var->method() is not split (only )-> chains expand)', () => {
    const input = '$tag->setTranslation(\'name\',$locale,$name);'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `$tag->setTranslation(
    'name',
    $locale,
    $name
);`)
});
(0, import_node_test.default)('expandContent: $var->method() with leading indent is not split', () => {
    const input = '    $tag->setTranslation(\'name\',$locale,$name);'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    $tag->setTranslation(
        'name',
        $locale,
        $name
    );`)
});
(0, import_node_test.default)('expandContent: consecutive dots are never expanded (spread/rest)', () => {
    const input = 'something...'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'something...')
});
(0, import_node_test.default)('expandContent: spread inside parens stays glued', () => {
    const input = 'foo(...args)'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo(...args)')
});
(0, import_node_test.default)('expandContent: isolated dot chains still expand', () => {
    const input = 'foo.bar.baz'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo
${TAB}.bar
${TAB}.baz`)
});
(0, import_node_test.default)('expandContent: ?. keeps the question mark bonded like ->', () => {
    const input = 'a?.b.c'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `a
${TAB}?.b
${TAB}.c`)
});
(0, import_node_test.default)('expandContent: repeated ?. chains expand per operator', () => {
    const input = 'a?.b?.c'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `a
${TAB}?.b
${TAB}?.c`)
});
(0, import_node_test.default)('expandContent: spaced ternary breaks before ? and :', () => {
    const input = 'something ? \'yes\' : \'no\''
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `something
${TAB}? 'yes'
${TAB}: 'no'`)
});
(0, import_node_test.default)('expandContent: ternary keeps nullish coalescing branches intact', () => {
    const input = 'let x = a ? b ?? c : d'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `let x = a
${TAB}? b ?? c
${TAB}: d`)
});
(0, import_node_test.default)('expandContent: ternary inside parens is wrapped Prettier-style', () => {
    const input = 'call(a ? b : c)'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `call(
${TAB}a
${TAB}? b
${TAB}: c
)`)
});
(0, import_node_test.default)('expandContent: commas inside string literals are preserved', () => {
    const input = 'foo(\'a, b\')'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo(\'a, b\')')
});
(0, import_node_test.default)('expandContent: chain operators inside string literals are preserved', () => {
    const input = 'foo(\'a->b\')'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo(\'a->b\')')
});
(0, import_node_test.default)('expandContent: template literals are preserved (typescript)', () => {
    const input = 'const s = `a, b`'
    const result = contentExpand(input, 4, true, 'typescript')
    import_strict.default.equal(result, 'const s = `a, b`')
});
(0, import_node_test.default)('expandContent: regex literals are preserved (typescript)', () => {
    const input = 'const re = /a, b/g'
    const result = contentExpand(input, 4, true, 'typescript')
    import_strict.default.equal(result, 'const re = /a, b/g')
});
(0, import_node_test.default)('expandContent: nested arrays expand only at the outermost level', () => {
    const input = 'foo([a, [b, c]])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo([
${TAB}a,
${TAB}[b, c]
])`)
});
(0, import_node_test.default)('expandContent: array of objects splits on commas outside braces', () => {
    const input = 'foo([{a: 1}, {b: 2}])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo([
${TAB}{a: 1},
${TAB}{b: 2}
])`)
});
(0, import_node_test.default)('expandContent: nested call in chain expands recursively (regression)', () => {
    const input = 'redirect()->intended(route(DashboardConstants::ROUTE_PARAM, absolute: false));'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `redirect()
${TAB}->intended(
${TAB}${TAB}route(
${TAB}${TAB}${TAB}DashboardConstants::ROUTE_PARAM,
${TAB}${TAB}${TAB}absolute: false
${TAB}${TAB})
${TAB});`)
});
(0, import_node_test.default)('expandContent: nested call in chain with leading indent (regression)', () => {
    const input = '    redirect()->intended(route(DashboardConstants::ROUTE_PARAM, absolute: false));'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    redirect()
${TAB}${TAB}->intended(
${TAB}${TAB}${TAB}route(
${TAB}${TAB}${TAB}${TAB}DashboardConstants::ROUTE_PARAM,
${TAB}${TAB}${TAB}${TAB}absolute: false
${TAB}${TAB}${TAB})
${TAB}${TAB});`)
});
(0, import_node_test.default)('expandContent: nested call with single light arg stays on the wrapper line', () => {
    const input = 'foo(a, bar(b))'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo(
${TAB}a,
${TAB}bar(b)
)`)
});
(0, import_node_test.default)('expandContent: nested call as first argument', () => {
    const input = 'foo(bar(b), a)'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo(
${TAB}bar(b),
${TAB}a
)`)
});
(0, import_node_test.default)('expandContent: nested multi-arg call expands both levels', () => {
    const input = 'foo(a, bar(b, c))'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo(
${TAB}a,
${TAB}bar(
${TAB}${TAB}b,
${TAB}${TAB}c
${TAB})
)`)
});
(0, import_node_test.default)('expandContent: deeply nested calls expand level by level', () => {
    const input = 'foo(bar(baz(1, 2), 3), 4)'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo(
${TAB}bar(
${TAB}${TAB}baz(
${TAB}${TAB}${TAB}1,
${TAB}${TAB}${TAB}2
${TAB}${TAB}),
${TAB}${TAB}3
${TAB}),
${TAB}4
)`)
});
(0, import_node_test.default)('expandContent: single-arg nested call that fits stays inline', () => {
    const input = 'foo(bar(b))'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo(bar(b))')
});
(0, import_node_test.default)('expandContent: comma before an array does not wrap the call', () => {
    const input = 'foo(a, [b, c])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo(a, [
${TAB}b,
${TAB}c
])`)
});
(0, import_node_test.default)('expandContent: trailing comma inside array is handled cleanly', () => {
    const input = 'foo([a, b,])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo([
${TAB}a,
${TAB}b
])`)
});
(0, import_node_test.default)('expandContent: trailing comma in call args is never split', () => {
    const input = 'foo(bar,)'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo(bar,)')
});
(0, import_node_test.default)('expandContent: bare comma list expands at the same indent', () => {
    const input = 'DashboardConstants::ROUTE_PARAM, absolute: false'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `DashboardConstants::ROUTE_PARAM,
absolute: false`)
});
(0, import_node_test.default)('expandContent: indented bare comma list keeps its indent', () => {
    const input = '    DashboardConstants::ROUTE_PARAM, absolute: false'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    DashboardConstants::ROUTE_PARAM,
    absolute: false`)
});
(0, import_node_test.default)('expandContent: already-broken list is not double-broken', () => {
    const input = 'a,\nb'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'a,\nb')
});
(0, import_node_test.default)('expandContent: pre-formatted multi-line group stays flat', () => {
    const input = 'foo(\n    a,\n    b\n)'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo(\n    a,\n    b\n)')
})
