const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config()

const API_KEY = process.env.RIOT_API_KEY
const REGION = 'euw1'
const MATCH_REGION = 'europe'

// Rate limiter: every Riot request goes through one queue that respects BOTH key limits at once.
// Requests wait for a free slot instead of failing. 'high' priority (page loads) jumps ahead of
// 'low' priority (background match backfill), so rank cards don't wait minutes behind a backfill.
// Each window has a small extra margin: Riot counts a request when it arrives, so without it
// a burst right at the window boundary still gets a 429.
const LIMITS = [
    { max: 20, ms: 1000 + 100 },
    { max: 100, ms: 2 * 60 * 1000 + 2000 },
]
const MAX_RETRIES = 5
const sent = [] // timestamps of sent requests, oldest first
const queue = []
let pausedUntil = 0 // set from Retry-After on a 429
let pumping = false

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function pump() {
    if (pumping) return
    pumping = true
    while (queue.length) {
        const now = Date.now()
        const longest = Math.max(...LIMITS.map(l => l.ms))
        while (sent.length && now - sent[0] >= longest) sent.shift()

        let wait = pausedUntil - now
        for (const { max, ms } of LIMITS) {
            const inWindow = sent.filter(t => now - t < ms)
            if (inWindow.length >= max) wait = Math.max(wait, inWindow[0] + ms - now)
        }
        if (wait > 0) {
            await sleep(wait)
            continue
        }
        sent.push(now)
        queue.shift().run()
    }
    pumping = false
}

function riotGet(url, { params, priority = 'high' } = {}) {
    return new Promise((resolve, reject) => {
        let tries = 0
        const job = {
            priority,
            run: () => axios.get(url, { params, headers: { 'X-Riot-Token': API_KEY } })
                .then(response => resolve(response.data))
                .catch(err => {
                    if (err.response?.status === 429 && tries++ < MAX_RETRIES) {
                        const retryAfter = Number(err.response.headers['retry-after']) || 10
                        pausedUntil = Math.max(pausedUntil, Date.now() + retryAfter * 1000)
                        console.warn(`Riot 429, waiting ${retryAfter}s`)
                        queue.unshift(job)
                        pump()
                        return
                    }
                    reject(err)
                }),
        }
        if (priority === 'high') {
            const firstLow = queue.findIndex(j => j.priority !== 'high')
            queue.splice(firstLow === -1 ? queue.length : firstLow, 0, job)
        } else {
            queue.push(job)
        }
        pump()
    })
}

async function getSummoner(gameName, tagLine) {
    return riotGet(`https://${MATCH_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
}

async function getLP(puuid) {
    return riotGet(`https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`)
}
async function getSummonerByPuuid(puuid) {
    return riotGet(`https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`)
}

// Match-v5 IDs, e.g. { queue: 420, startTime, start, count }
async function getMatchIds(puuid, params) {
    return riotGet(`https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`, { params, priority: 'low' })
}

async function getMatch(matchId) {
    return riotGet(`https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`, { priority: 'low' })
}

module.exports = { getSummoner, getLP, getSummonerByPuuid, getMatchIds, getMatch }
