const axios = require('axios')

// Data Dragon: latest version + champion list, cached for a few hours.
// Champions are mapped by their numeric key (match-v5 championId), which is always reliable.
// Match-v5 championName can differ from Data Dragon ids (e.g. "FiddleSticks" vs "Fiddlesticks"),
// so the name lookup is only a case-insensitive fallback.
const CACHE_MS = 6 * 60 * 60 * 1000

let cache = null
let loadedAt = 0

async function load() {
    if (cache && Date.now() - loadedAt < CACHE_MS) return cache
    const [version] = (await axios.get('https://ddragon.leagueoflegends.com/api/versions.json')).data
    const { data } = (await axios.get(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).data
    const byKey = {}, byName = {}
    for (const c of Object.values(data)) {
        const champ = { id: c.id, name: c.name, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png` }
        byKey[c.key] = champ
        byName[c.id.toLowerCase()] = champ
    }
    cache = { byKey, byName }
    loadedAt = Date.now()
    return cache
}

// Returns { name, icon } for a match-v5 participant's championId / championName.
// If Data Dragon can't be reached, falls back to the raw name and no icon (client shows a placeholder).
async function champion(championId, championName) {
    try {
        const { byKey, byName } = await load()
        const c = byKey[championId] ?? byName[championName?.toLowerCase()]
        if (c) return { name: c.name, icon: c.icon }
    } catch (err) {
        console.error('Data Dragon:', err.message)
    }
    return { name: championName, icon: null }
}

module.exports = { champion }
