/** A non-code range identified by document offsets (character positions from start of document). */
export interface NonCodeRange {
    readonly startOffset : number
    readonly endOffset   : number
    readonly kind        : 'string' | 'comment' | 'template'
}

export function isInsideOffsetRange(offset: number, ranges: NonCodeRange[], opts?: {excludeKinds?: string[]}): boolean {
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
