import test from 'node:test'
import assert from 'node:assert/strict'
import {isInsideOffsetRange, NonCodeRange} from './nonCode'

// ── isInsideOffsetRange (basic) ──────────────────────────────────────

test('isInsideOffsetRange: offset at startOffset is inside', () => {
    const ranges: NonCodeRange[] = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    assert.equal(isInsideOffsetRange(5, ranges), true)
})

test('isInsideOffsetRange: offset at endOffset is NOT inside (boundary fix)', () => {
    const ranges: NonCodeRange[] = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    assert.equal(isInsideOffsetRange(10, ranges), false)
})

test('isInsideOffsetRange: offset one before endOffset is inside', () => {
    const ranges: NonCodeRange[] = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    assert.equal(isInsideOffsetRange(9, ranges), true)
})

test('isInsideOffsetRange: offset before startOffset is outside', () => {
    const ranges: NonCodeRange[] = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    assert.equal(isInsideOffsetRange(4, ranges), false)
})

test('isInsideOffsetRange: offset after endOffset is outside', () => {
    const ranges: NonCodeRange[] = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    assert.equal(isInsideOffsetRange(11, ranges), false)
})

test('isInsideOffsetRange: empty ranges returns false', () => {
    assert.equal(isInsideOffsetRange(5, []), false)
})

// ── Blade scenario: closing paren after a string ────────────────────
// In `{{ __(|'text') }}`, the string `'text'` occupies offsets [6, 12).
// The `)` at offset 12 should NOT be treated as inside the string.

test('isInsideOffsetRange: closing paren after string is NOT inside (Blade bug)', () => {
    const ranges: NonCodeRange[] = [{startOffset: 6, endOffset: 12, kind: 'string'}]
    assert.equal(isInsideOffsetRange(12, ranges), false)
})

// ── excludeKinds option ─────────────────────────────────────────────

test('isInsideOffsetRange: excludeKinds skips matching kinds', () => {
    const ranges: NonCodeRange[] = [
        {startOffset: 0, endOffset: 20, kind: 'template'},
        {startOffset: 5, endOffset: 10, kind: 'string'},
    ]
    assert.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template']}), true)
})

test('isInsideOffsetRange: excludeKinds allows offset inside excluded kind', () => {
    const ranges: NonCodeRange[] = [
        {startOffset: 0, endOffset: 20, kind: 'template'},
    ]
    assert.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template']}), false)
})

test('isInsideOffsetRange: excludeKinds with multiple kinds', () => {
    const ranges: NonCodeRange[] = [
        {startOffset: 0, endOffset: 20, kind: 'template'},
        {startOffset: 5, endOffset: 10, kind: 'string'},
        {startOffset: 12, endOffset: 15, kind: 'comment'},
    ]
    assert.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template']}), true)
    assert.equal(isInsideOffsetRange(13, ranges, {excludeKinds: ['template']}), true)
    assert.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template', 'string']}), false)
})

test('isInsideOffsetRange: excludeKinds empty array behaves like no option', () => {
    const ranges: NonCodeRange[] = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    assert.equal(isInsideOffsetRange(7, ranges, {excludeKinds: []}), true)
    assert.equal(isInsideOffsetRange(7, ranges), true)
})
