const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const { getSummoner, getSummonerByPuuid, getLP } = require('./riot')

dotenv.config()

const app = express()

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    res.send('Website is running!')
})

app.get('/ranked/:name/:tag', async (req, res) => {
    const account = await getSummoner(req.params.name, req.params.tag)
    console.log('account:', account)
    const summoner = await getSummonerByPuuid(account.puuid)
    console.log('summoner:', summoner)
    const ranked = await getLP(summoner.puuid)
    res.json(ranked)
})

app.get('/players', (req, res) => {
    const filePath = path.join(__dirname, 'players.json')
    if (!fs.existsSync(filePath)) return res.json([])
    const data = fs.readFileSync(filePath, 'utf8')
    res.json(JSON.parse(data))
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

app.listen(3000, () => {
    console.log('server running at port 3000')
})