const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const { getSummoner, getLP } = require('./riot')
const { refresh, favoriteChampions } = require('./champions')

dotenv.config()

const app = express()

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    res.send('Website is running!')
})

const PLAYERS_FILE = path.join(__dirname, 'players.json')
const readPlayers = () => fs.existsSync(PLAYERS_FILE) ? JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')) : []

// PUUID for a Riot ID, looked up once and then saved into players.json so page loads don't spend API calls on it
async function getPuuid(name, tag) {
    const players = readPlayers()
    const player = players.find(p => p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase())
    if (player?.puuid) return player.puuid
    const account = await getSummoner(name, tag)
    if (player) {
        player.puuid = account.puuid
        fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players))
    }
    return account.puuid
}

app.get('/ranked/:name/:tag', async (req, res) => {
    const puuid = await getPuuid(req.params.name, req.params.tag)
    const ranked = await getLP(puuid)
    res.json(ranked)
})

// Favorite champions: answers right away from the cache and starts a background refresh (with cooldown)
app.get('/champions/:name/:tag', async (req, res) => {
    const puuid = await getPuuid(req.params.name, req.params.tag)
    refresh(puuid)
    res.json(await favoriteChampions(puuid))
})

app.get('/players', (req, res) => {
    res.json(readPlayers().map(({ name, tag }) => ({ name, tag })))
})

app.post('/players', (req, res) => {
    const { name, tag } = req.body
    const filePath = path.join(__dirname, 'players.json')
    const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : []
    if (existing.find(p => p.name === name && p.tag === tag)) {
        return res.json({ message: 'This player has already been added' })
    }
    existing.push({ name, tag })
    fs.writeFileSync(filePath, JSON.stringify(existing))
    res.json({ message: 'Player saved!' })
})

app.listen(3000, async () => {
    console.log('server running at port 3000')
    // Start the champion backfill for everyone right away instead of waiting for the first page view
    for (const { name, tag } of readPlayers()) {
        try { refresh(await getPuuid(name, tag)) } catch (err) { console.error(`Champion sync ${name}#${tag}:`, err.response?.status ?? err.message) }
    }
})