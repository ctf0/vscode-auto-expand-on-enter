import * as vscode from 'vscode'

interface ExpandConfig {
    charsList : Record<string, string>
    open      : string[]
    close     : string[]
    languages : string[]
}

let config: ExpandConfig = {
    charsList : {},
    open      : [],
    close     : [],
    languages : [],
}

export function getCharsList(): Record<string, string> {
    return config.charsList
}

export function getOpen(): string[] {
    return config.open
}

export function getClose(): string[] {
    return config.close
}

export function getLanguages(): string[] {
    return config.languages
}

export function invertSelections(arr: readonly vscode.Selection[]): vscode.Selection[] {
    return [...arr]
        .sort((a, b) => {
            const lineDiff = a.start.line - b.start.line

            if (lineDiff !== 0) {
                return lineDiff
            }

            return a.start.character - b.start.character
        })
        .reverse()
}

export function readConfig() {
    const vscodeConfig = vscode.workspace.getConfiguration('autoExpandOnEnter')
    const rawList = vscodeConfig.get<Record<string, string>>('list', {})
    const rawLanguages = vscodeConfig.get<string[]>('languages', [])

    const validatedCharsList: Record<string, string> = {}

    if (typeof rawList === 'object' && rawList !== null && !Array.isArray(rawList)) {
        for (const [key, value] of Object.entries(rawList)) {
            if (typeof key === 'string' && typeof value === 'string' && key.length >= 1 && value.length >= 1) {
                validatedCharsList[key] = value
            }
        }
    }

    const validatedLanguages: string[] = Array.isArray(rawLanguages)
        ? rawLanguages.filter((lang): lang is string => typeof lang === 'string')
        : []

    config = {
        charsList : validatedCharsList,
        open      : Object.keys(validatedCharsList),
        close     : Object.values(validatedCharsList),
        languages : validatedLanguages,
    }
}
