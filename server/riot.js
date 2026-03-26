const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config()

const API_KEY = process.env.RIOT_API_KEY
const REGION = 'euw1'
const MATCH_REGION = 'europe'

async function getSummoner(gameName, tagLine) {
    const response = await axios.get(
        `https://${MATCH_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
        { headers: { 'X-Riot-Token': API_KEY } }
    )
    return response.data
}

async function getLP(puuid) {
    const response = await axios.get(
        `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
        { headers: { 'X-Riot-Token': API_KEY } }
    )
    return response.data
}
async function getSummonerByPuuid(puuid) {
    const response = await axios.get(
        `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        { headers: { 'X-Riot-Token': API_KEY } }
    )
    return response.data
}

module.exports = { getSummoner, getLP, getSummonerByPuuid }