async function loadPlayers() {
    document.getElementById('result').innerHTML = ''
    const response = await fetch('http://localhost:3000/players')
    const players = await response.json()
    for (const player of players) {
        await displayPlayer(player.name, player.tag)
    }
}

async function search() {
    const name = document.getElementById('gameName').value.trim()
    const tag = document.getElementById('tagLine').value.trim()
    if (!name || !tag) return
    const response = await fetch('http://localhost:3000/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tag })
    })
    const result = await response.json()
    if (result.message === 'Player saved!') {
        await displayPlayer(name, tag)
    }
}

function tierClass(tier) {
    return tier ? `tier-${tier.toLowerCase()}` : ''
}

function winRate(wins, losses) {
    const total = wins + losses
    return total === 0 ? 0 : Math.round((wins / total) * 100)
}

async function displayPlayer(name, tag) {
    const response = await fetch(`http://localhost:3000/ranked/${name}/${tag}`)
    const data = await response.json()
    const solo = data.find(entry => entry.queueType === 'RANKED_SOLO_5x5')

    const card = document.createElement('div')
    card.className = 'player-card'

    const wins = solo ? solo.wins : 0
    const losses = solo ? solo.losses : 0
    const wr = winRate(wins, losses)
    const wrClass = wr >= 50 ? 'win-rate' : 'win-rate low'

    const rankHtml = solo
        ? `<div class="rank-row">
            <span class="rank-badge ${tierClass(solo.tier)}">${solo.tier} ${solo.rank}</span>
            <span class="lp">${solo.leaguePoints} LP</span>
           </div>`
        : `<div class="unranked">Unranked</div>`

    card.innerHTML = `
        <div class="player-name">${name}<span>#${tag}</span></div>
        <div class="queue-label">Solo / Duo</div>
        ${rankHtml}
        <div class="stats-row">
            <div class="stat">
                <span class="stat-label">Wins</span>
                <span class="stat-value">${wins}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Losses</span>
                <span class="stat-value">${losses}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Win Rate</span>
                <span class="stat-value ${wrClass}">${wins + losses > 0 ? wr + '%' : '—'}</span>
            </div>
        </div>
        <div class="champions">
            <div class="queue-label">Favorite Champions</div>
            <div class="champ-list"><div class="champ-empty">Loading…</div></div>
        </div>
    `
    document.getElementById('result').appendChild(card)
    loadChampions(card, name, tag)
}

// Shown if a champion icon is missing or fails to load
const CHAMP_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#1e2540"/>' +
    '<text x="20" y="26" font-family="sans-serif" font-size="18" fill="#3d4560" text-anchor="middle">?</text></svg>')
const CHAMP_POLL_MS = 5000

// Top 3 Solo/Duo champions from the server's cache. While the server is still syncing
// match history in the background, shows progress and checks again every few seconds.
async function loadChampions(card, name, tag) {
    if (!card.isConnected) return // card was removed (list reloaded)
    const list = card.querySelector('.champ-list')
    let data
    try {
        const response = await fetch(`http://localhost:3000/champions/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)
        if (!response.ok) throw new Error(response.status)
        data = await response.json()
    } catch {
        list.innerHTML = `<div class="champ-empty">Couldn't load champions</div>`
        return
    }

    const { champions, syncing } = data
    const progress = syncing && syncing.total ? ` ${syncing.done}/${syncing.total}` : ''
    if (champions.length) {
        list.innerHTML = champions.map(c => `
            <div class="champ">
                <img class="champ-icon" src="${c.icon || CHAMP_PLACEHOLDER}" alt="" loading="lazy">
                <span class="champ-name">${c.name}</span>
                <span class="champ-stats"><span class="${c.winrate >= 50 ? 'win-rate' : 'win-rate low'}">${c.winrate}%</span> · ${c.games} games</span>
            </div>`).join('') +
            (syncing ? `<div class="champ-sync">Syncing match history…${progress}</div>` : '')
        list.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.src = CHAMP_PLACEHOLDER }, { once: true }))
    } else {
        list.innerHTML = `<div class="champ-empty">${syncing ? `Syncing match history…${progress}` : 'Not enough ranked games'}</div>`
    }
    if (syncing) setTimeout(() => loadChampions(card, name, tag), CHAMP_POLL_MS)
}

loadPlayers()
