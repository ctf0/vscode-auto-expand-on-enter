import test from 'node:test'
import assert from 'node:assert/strict'
import {contentExpand} from './expandString'

const TAB = '    '

// ── array expansion ────────────────────────────────────────────────

test('expandContent: single-line array expands with correct indentation (no chain)', () => {
    const input = 'foo([a, b])'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo([
${TAB}a,
${TAB}b
])`)
})

test('expandContent: single-line array with leading indent uses chainIndent', () => {
    const input = '    foo([a, b])'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `    foo([
${TAB}${TAB}a,
${TAB}${TAB}b
${TAB}])`)
})

test('expandContent: array with single element is not expanded', () => {
    const input = 'foo([a])'
    const result = contentExpand(input, 4, true)
    assert.equal(result, 'foo([a])')
})

// ── chain expansion ────────────────────────────────────────────────

test('expandContent: chain method with array where closing bracket aligns at chain level', () => {
    const input = 'foo()->bar([a, b, c])->baz()'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo()
${TAB}->bar([
${TAB}${TAB}a,
${TAB}${TAB}b,
${TAB}${TAB}c
${TAB}])
${TAB}->baz()`)
})

test('expandContent: indented line with chain and array uses chainIndent for alignment', () => {
    const input = '    foo()->bar([a, b])->baz()'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `    foo()
${TAB}${TAB}->bar([
${TAB}${TAB}${TAB}a,
${TAB}${TAB}${TAB}b
${TAB}${TAB}])
${TAB}${TAB}->baz()`)
})

test('expandContent: PHP-style chain with whereIn array uses chainIndent for alignment', () => {
    const input = '$roles = Role::query()->whereIn(\'name\', [DashboardConstants::ROUTE_PARAM, ProfileConstants::ROUTE_PARAM])->get()->merge($authModel->roles)->unique();'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `$roles = Role::query()
    ->whereIn('name', [
        DashboardConstants::ROUTE_PARAM,
        ProfileConstants::ROUTE_PARAM
    ])
    ->get()
    ->merge($authModel->roles)
    ->unique();`)
})

test('expandContent: chain expansion for -> operators', () => {
    const input = 'foo()->bar()->baz()'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo()
${TAB}->bar()
${TAB}->baz()`)
})

test('expandContent: dot-chained calls expand like arrow chains', () => {
    const input = 'foo().bar().baz()'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo()
${TAB}.bar()
${TAB}.baz()`)
})

test('expandContent: $var->method() is not split (only )-> chains expand)', () => {
    const input = '$tag->setTranslation(\'name\',$locale,$name);'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `$tag->setTranslation(
    'name',
    $locale,
    $name
);`)
})

test('expandContent: $var->method() with leading indent is not split', () => {
    const input = '    $tag->setTranslation(\'name\',$locale,$name);'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `    $tag->setTranslation(
        'name',
        $locale,
        $name
    );`)
})

// ── consecutive dots are ignored ───────────────────────────────────

test('expandContent: consecutive dots are never expanded (spread/rest)', () => {
    const input = 'something...'
    const result = contentExpand(input, 4, true)
    assert.equal(result, 'something...')
})

test('expandContent: spread inside parens stays glued', () => {
    const input = 'foo(...args)'
    const result = contentExpand(input, 4, true)
    assert.equal(result, 'foo(...args)')
})

test('expandContent: isolated dot chains still expand', () => {
    const input = 'foo.bar.baz'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo
${TAB}.bar
${TAB}.baz`)
})

// ── optional chaining ──────────────────────────────────────────────

test('expandContent: ?. keeps the question mark bonded like ->', () => {
    const input = 'a?.b.c'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `a
${TAB}?.b
${TAB}.c`)
})

test('expandContent: repeated ?. chains expand per operator', () => {
    const input = 'a?.b?.c'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `a
${TAB}?.b
${TAB}?.c`)
})

// ── spaced ternary ─────────────────────────────────────────────────

test('expandContent: spaced ternary breaks before ? and :', () => {
    const input = 'something ? \'yes\' : \'no\''
    const result = contentExpand(input, 4, true)
    assert.equal(result, `something
${TAB}? 'yes'
${TAB}: 'no'`)
})

test('expandContent: ternary keeps nullish coalescing branches intact', () => {
    const input = 'let x = a ? b ?? c : d'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `let x = a
${TAB}? b ?? c
${TAB}: d`)
})

test('expandContent: ternary inside parens is wrapped Prettier-style', () => {
    const input = 'call(a ? b : c)'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `call(
${TAB}a
${TAB}? b
${TAB}: c
)`)
})

// ── literal masking ─────────────────────────────────────────────────

test('expandContent: commas inside string literals are preserved', () => {
    const input = 'foo(\'a, b\')'
    const result = contentExpand(input, 4, true)
    assert.equal(result, 'foo(\'a, b\')')
})

test('expandContent: chain operators inside string literals are preserved', () => {
    const input = 'foo(\'a->b\')'
    const result = contentExpand(input, 4, true)
    assert.equal(result, 'foo(\'a->b\')')
})

test('expandContent: template literals are preserved (typescript)', () => {
    const input = 'const s = `a, b`'
    const result = contentExpand(input, 4, true, 'typescript')
    assert.equal(result, 'const s = `a, b`')
})

test('expandContent: regex literals are preserved (typescript)', () => {
    const input = 'const re = /a, b/g'
    const result = contentExpand(input, 4, true, 'typescript')
    assert.equal(result, 'const re = /a, b/g')
})

// ── nested array / brace-aware splitting ───────────────────────────

test('expandContent: nested arrays expand only at the outermost level', () => {
    const input = 'foo([a, [b, c]])'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo([
${TAB}a,
${TAB}[b, c]
])`)
})

test('expandContent: array of objects splits on commas outside braces', () => {
    const input = 'foo([{a: 1}, {b: 2}])'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo([
${TAB}{a: 1},
${TAB}{b: 2}
])`)
})

// ── trailing-comma handling ─────────────────────────────────────────

test('expandContent: trailing comma inside array is handled cleanly', () => {
    const input = 'foo([a, b,])'
    const result = contentExpand(input, 4, true)
    assert.equal(result, `foo([
${TAB}a,
${TAB}b
])`)
})

test('expandContent: trailing comma in call args is never split', () => {
    const input = 'foo(bar,)'
    const result = contentExpand(input, 4, true)
    assert.equal(result, 'foo(bar,)')
})
