const fs = require('fs')
const path = require('path')
const { getMatchIds, getMatch } = require('./riot')
const { champion } = require('./ddragon')

// Favorite champions: top champions by games played in Ranked Solo/Duo over the last 3 months.
const MIN_GAMES = 5 // a champion needs at least this many games to show up
const TOP_N = 3
const QUEUE_SOLO_DUO = 420
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000 // ~3 months
const REFRESH_COOLDOWN_MS = 15 * 60 * 1000 // refresh a friend at most this often
const REMAKE_SECONDS = 5 * 60 // shorter games are remakes and don't count

// matches.json: { [puuid]: { lastRefresh, matches: { [matchId]: { championId, championName, win, duration, timestamp, remake } } } }
// Every processed match is stored, remakes too, so a match is never fetched twice.
const MATCHES_FILE = path.join(__dirname, 'matches.json')
let store = {}
try { store = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8')) } catch {}
const save = () => fs.writeFileSync(MATCHES_FILE, JSON.stringify(store))

const syncing = new Map() // puuid -> { done, total } while a background refresh runs
const lastAttempt = new Map() // puuid -> time of last refresh start (in memory, so a failed refresh still waits the cooldown)

// Starts a background refresh unless one is running or the cooldown hasn't passed. Never throws.
function refresh(puuid) {
    const entry = store[puuid]
    const last = Math.max(entry?.lastRefresh ?? 0, lastAttempt.get(puuid) ?? 0)
    if (syncing.has(puuid) || Date.now() - last < REFRESH_COOLDOWN_MS) return
    lastAttempt.set(puuid, Date.now())
    syncing.set(puuid, { done: 0, total: 0 })
    sync(puuid)
        .catch(err => console.error(`Champion sync ${puuid.slice(0, 8)}:`, err.response?.status ?? err.message))
        .finally(() => syncing.delete(puuid))
}

async function sync(puuid) {
    const entry = store[puuid] ??= { lastRefresh: 0, matches: {} }
    const cutoff = Date.now() - WINDOW_MS

    // Drop matches that have aged out of the window
    for (const [id, m] of Object.entries(entry.matches)) if (m.timestamp < cutoff) delete entry.matches[id]

    // All Solo/Duo match IDs in the window, 100 per page
    const ids = []
    for (let start = 0; ; start += 100) {
        const page = await getMatchIds(puuid, { queue: QUEUE_SOLO_DUO, startTime: Math.floor(cutoff / 1000), start, count: 100 })
        ids.push(...page)
        if (page.length < 100) break
    }

    const missing = ids.filter(id => !entry.matches[id])
    const progress = syncing.get(puuid)
    progress.total = missing.length

    for (const id of missing) {
        try {
            const { info } = await getMatch(id)
            const p = info.participants.find(p => p.puuid === puuid)
            if (p) entry.matches[id] = {
                championId: p.championId,
                championName: p.championName,
                win: p.win,
                duration: info.gameDuration,
                timestamp: info.gameStartTimestamp ?? info.gameCreation,
                remake: info.gameDuration < REMAKE_SECONDS || p.gameEndedInEarlySurrender === true,
            }
        } catch (err) {
            if (err.response?.status !== 404) throw err // 404 = match gone, skip it
        }
        progress.done++
        if (progress.done % 10 === 0) save() // keep progress if the server stops mid-backfill
    }
    entry.lastRefresh = Date.now()
    save()
}

// Top champions from what's cached right now, plus sync progress if a refresh is running
async function favoriteChampions(puuid) {
    const cutoff = Date.now() - WINDOW_MS
    const stats = new Map() // championId -> { championName, games, wins }
    for (const m of Object.values(store[puuid]?.matches ?? {})) {
        if (m.remake || m.timestamp < cutoff) continue
        const s = stats.get(m.championId) ?? { championName: m.championName, games: 0, wins: 0 }
        s.games++
        if (m.win) s.wins++
        stats.set(m.championId, s)
    }
    const top = [...stats.entries()]
        .filter(([, s]) => s.games >= MIN_GAMES)
        .sort(([, a], [, b]) => b.games - a.games || b.wins / b.games - a.wins / a.games)
        .slice(0, TOP_N)

    const champions = await Promise.all(top.map(async ([championId, s]) => ({
        ...(await champion(championId, s.championName)),
        games: s.games,
        winrate: Math.round((s.wins / s.games) * 100),
    })))
    return { champions, syncing: syncing.get(puuid) ?? null, minGames: MIN_GAMES }
}

module.exports = { refresh, favoriteChampions }
