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

// src/libs/grammar.test.ts
var import_node_test = __toESM(require('node:test'))
var import_strict = __toESM(require('node:assert/strict'))

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

// src/libs/grammar.test.ts
(0, import_node_test.default)('isInsideOffsetRange: offset at startOffset is inside', () => {
    const ranges = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(5, ranges), true)
});
(0, import_node_test.default)('isInsideOffsetRange: offset at endOffset is NOT inside (boundary fix)', () => {
    const ranges = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(10, ranges), false)
});
(0, import_node_test.default)('isInsideOffsetRange: offset one before endOffset is inside', () => {
    const ranges = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(9, ranges), true)
});
(0, import_node_test.default)('isInsideOffsetRange: offset before startOffset is outside', () => {
    const ranges = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(4, ranges), false)
});
(0, import_node_test.default)('isInsideOffsetRange: offset after endOffset is outside', () => {
    const ranges = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(11, ranges), false)
});
(0, import_node_test.default)('isInsideOffsetRange: empty ranges returns false', () => {
    import_strict.default.equal(isInsideOffsetRange(5, []), false)
});
(0, import_node_test.default)('isInsideOffsetRange: closing paren after string is NOT inside (Blade bug)', () => {
    const ranges = [{startOffset: 6, endOffset: 12, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(12, ranges), false)
});
(0, import_node_test.default)('isInsideOffsetRange: excludeKinds skips matching kinds', () => {
    const ranges = [
        {startOffset: 0, endOffset: 20, kind: 'template'},
        {startOffset: 5, endOffset: 10, kind: 'string'},
    ]
    import_strict.default.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template']}), true)
});
(0, import_node_test.default)('isInsideOffsetRange: excludeKinds allows offset inside excluded kind', () => {
    const ranges = [
        {startOffset: 0, endOffset: 20, kind: 'template'},
    ]
    import_strict.default.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template']}), false)
});
(0, import_node_test.default)('isInsideOffsetRange: excludeKinds with multiple kinds', () => {
    const ranges = [
        {startOffset: 0, endOffset: 20, kind: 'template'},
        {startOffset: 5, endOffset: 10, kind: 'string'},
        {startOffset: 12, endOffset: 15, kind: 'comment'},
    ]
    import_strict.default.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template']}), true)
    import_strict.default.equal(isInsideOffsetRange(13, ranges, {excludeKinds: ['template']}), true)
    import_strict.default.equal(isInsideOffsetRange(7, ranges, {excludeKinds: ['template', 'string']}), false)
});
(0, import_node_test.default)('isInsideOffsetRange: excludeKinds empty array behaves like no option', () => {
    const ranges = [{startOffset: 5, endOffset: 10, kind: 'string'}]
    import_strict.default.equal(isInsideOffsetRange(7, ranges, {excludeKinds: []}), true)
    import_strict.default.equal(isInsideOffsetRange(7, ranges), true)
})
