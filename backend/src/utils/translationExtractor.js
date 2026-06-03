const crypto = require('crypto')

const TRANS_PREFIX = 'trans '
const TRANS_REF = /^trans[:\s]?[0-9a-f]{64}$/

const TRANSLATABLE_FIELDS = {
    green_space: ['name', 'notes'],
    toilet: ['name', 'notes'],
    food_bank: ['name', 'notes', 'extended.needs'],
    library: ['name', 'notes', 'extended.operator'],
    recycling: ['name', 'notes', 'extended.operator'],
}

const generateId = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex')
const getPath = (obj, path) => path.split('.').reduce((acc, key) => acc?.[key], obj)

const setPath = (obj, path, value) => {
    const keys = path.split('.')
    const lastKey = keys.pop()

    let target = obj
    for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') return
        target = target[key]
    }

    target[lastKey] = value
}

function registerTranslation(text, store, recordType) {
    if (typeof text !== 'string' || TRANS_REF.test(text)) return text

    const cleanText = text.trim()
    if (!cleanText) return text

    const id = generateId(cleanText)

    store[id] ??= { en: cleanText, types: new Set() }
    store[id].types.add(recordType)

    return `${TRANS_PREFIX}${id}`
}

function extractTranslations(record, store) {
    const pathsToTranslate = TRANSLATABLE_FIELDS[record.type] || []

    for (const path of pathsToTranslate) {
        const value = getPath(record, path)

        if (Array.isArray(value)) setPath(record, path, value.map(item => registerTranslation(item, store, record.type)))
        else if (typeof value === 'string') setPath(record, path, registerTranslation(value, store, record.type))
    }

    return record
}

module.exports = {
    extractTranslations,
    TRANSLATABLE_FIELDS,
    TRANS_PREFIX,
}