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
var import_node_test = require('node:test')
var import_strict = __toESM(require('node:assert/strict'))

// src/libs/expandString.ts
var import_os = require('os')

function contentExpand(txt, tabSize, insertSpaces) {
    const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '	'
    const match = txt.match(/^[\t ]+/)
    const space = match?.[0] ?? ''
    const chainIndent = space + indentUnit
    let chainIndex = 0

    return txt.replace(/\s*(->|\.(?!\d))/g, (match2, operator, offset, str) => {
        const parenDepth = (str.slice(0, offset).match(/\(/g) || []).length - (str.slice(0, offset).match(/\)/g) || []).length

        if (parenDepth > 0) {
            return match2
        }

        const beforeOp = str.slice(0, offset).trimEnd()

        if (!beforeOp.endsWith(')')) {
            return match2
        }

        chainIndex++

        return offset === 0 ? match2 : `${import_os.EOL}${chainIndent}${operator}`
    }).replace(/([\t ]+)?(\&{2,}|\|{2,})([\t ]+)?/g, (match2) => `${match2.trimEnd()}${import_os.EOL}${chainIndent}`).replace(/\[([^\]]+)\]/g, (match2, content, offset, str) => {
        if (!content.includes(',')) {
            return match2
        }

        const lineStart = str.lastIndexOf('\n', offset) + 1
        const linePrefix = str.slice(lineStart, offset)
        const containingLineIndent = linePrefix.match(/^[\t ]*/)?.[0] ?? ''
        const elements = content.split(',').map((s) => s.trim()).filter(Boolean)

        return `[
${containingLineIndent}${indentUnit}${elements.join(`,
${containingLineIndent}${indentUnit}`)}
${containingLineIndent}]`
    }).replace(/(?<=['"\S])([\t ]+)?,([\t ]+)?['"\S]/g, (match2, off, _afterWs, offset, str) => {
        if (match2[match2.length - 1] === '[') {
            return match2
        }

        let bracketDepth = 0

        for (let i = 0; i < offset; i++) {
            if (str[i] === '[' || str[i] === '(') {
                bracketDepth++
            } else if (str[i] === ']' || str[i] === ')') {
                bracketDepth--
            }
        }

        const lineStart = str.lastIndexOf('\n', offset) + 1
        const linePrefix = str.slice(lineStart, offset)
        const lineIndent = linePrefix.match(/^[\t ]*/)?.[0] ?? ''
        const indent = bracketDepth > 0 ? lineIndent + indentUnit : lineIndent

        return match2.replace(/,[\t ]*/, `,${import_os.EOL}${indent}`)
    }).replace(/\(([^)\[\]]*\n[^)\[\]]*)\)/g, (match2, inner, offset, str) => {
        const beforeParen = str.slice(0, offset)
        const lineStart = beforeParen.lastIndexOf('\n') + 1
        const lineIndent = (beforeParen.slice(lineStart).match(/^[\t ]*/)?.[0] ?? '')
        const contentIndent = lineIndent + indentUnit

        return `(\n${contentIndent}${inner}\n${lineIndent})`
    })
}

// src/libs/expandString.test.ts
var TAB = '    ';
(0, import_node_test.test)('expandContent: single-line array expands with correct indentation (no chain)', () => {
    const input = 'foo([a, b])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo([
${TAB}a,
${TAB}b
])`)
});
(0, import_node_test.test)('expandContent: single-line array with leading indent uses chainIndent', () => {
    const input = '    foo([a, b])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    foo([
${TAB}${TAB}a,
${TAB}${TAB}b
${TAB}])`)
});
(0, import_node_test.test)('expandContent: chain method with array where closing bracket aligns at chain level', () => {
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
(0, import_node_test.test)('expandContent: indented line with chain and array uses chainIndent for alignment', () => {
    const input = '    foo()->bar([a, b])->baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    foo()
${TAB}${TAB}->bar([
${TAB}${TAB}${TAB}a,
${TAB}${TAB}${TAB}b
${TAB}${TAB}])
${TAB}${TAB}->baz()`)
});
(0, import_node_test.test)('expandContent: PHP-style chain with whereIn array uses chainIndent for alignment', () => {
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
(0, import_node_test.test)('expandContent: array with single element is not expanded', () => {
    const input = 'foo([a])'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, 'foo([a])')
});
(0, import_node_test.test)('expandContent: chain expansion for -> operators', () => {
    const input = 'foo()->bar()->baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo()
${TAB}->bar()
${TAB}->baz()`)
});
(0, import_node_test.test)('expandContent: && and || are expanded on new lines', () => {
    const input = 'foo() && bar() && baz()'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `foo() &&
${TAB}bar() &&
${TAB}baz()`)
});
(0, import_node_test.test)('expandContent: $var->method() is not split (only )-> chains expand)', () => {
    const input = '$tag->setTranslation(\'name\',$locale,$name);'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `$tag->setTranslation(
    'name',
    $locale,
    $name
);`)
});
(0, import_node_test.test)('expandContent: $var->method() with leading indent is not split', () => {
    const input = '    $tag->setTranslation(\'name\',$locale,$name);'
    const result = contentExpand(input, 4, true)
    import_strict.default.equal(result, `    $tag->setTranslation(
        'name',
        $locale,
        $name
    );`)
})
