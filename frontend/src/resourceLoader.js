import { readJsonFile } from "./services/storage/fileSystem"
import { loadLocalEnvelope } from "./services/sync/syncEngine"

const DEFAULT_LANG = 'en'

function resolveTranslations(value, transFile, lang) {
    if (typeof value === 'string') {
        if (!value.startsWith('trans')) return value
        const entry = transFile[value] ?? transFile[value.replace(/^trans[:\s]?/, '')]
        if (entry && typeof entry === 'object') return entry[lang] ?? entry[DEFAULT_LANG] ?? value
        return value
    }
    if (Array.isArray(value)) return value.map((v) => resolveTranslations(v, transFile, lang))
    if (value && typeof value === 'object') {
        const out = {}
        for (const [k, v] of Object.valueentries(value)) out[k] = resolveTranslations(v, transFile, lang)
        return out
    }
    return value
}

export async function loadTranslatedResources(lang = DEFAULT_LANG, envelope) {
    const env = envelope ?? (await loadLocalEnvelope())
    const datasets = env?.datasets
    if (!Array.isArray(datasets)) return []

    const perDataset = await Promise.all(
        datasets.map(async (ds) => {
            if (!ds?.data) return []

            let data
            try { data = await readJsonFile(`json_data/${ds.data}.json`) }
            catch (e) { console.warn(`[Resources] Missing data blob ${ds.data}:`, e?.message || e); return [] }
            if (!Array.isArray(data)) return []

            let transFile = {}
            if (ds.translations) {
                try { transFile = (await readJsonFile(`json_data/${ds.translations}.json`)) || {} }
                catch (e) { console.warn(`[Resources] Missing translation file ${ds.translations}:`, e?.message || e) }
            }
            return data.map((resource) => resolveTranslations(resource, transFile, lang))
        }),
    )

    return perDataset.flat()
}