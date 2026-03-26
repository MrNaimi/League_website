async function search() {
    const name = document.getElementById('gameName').value
    const tag = document.getElementById('tagLine').value

    await fetch('http://localhost:3000/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tag })
    })

    await displayPlayer(name, tag)


    async function loadPlayer() {
        const response = await fetch('http://localhost:3000/players')
        const players = await response.json

        for (const player of players) {
            await displayPlayer(player.name, player.tag)
        }
    }

    async function displayPlayer(name, tag) {
        const response = await fetch(`http://localhost:3000/ranked/${name}/${tag}`)
        const data = await response.json()
        const solo = data.find(entry => entry.queueType === 'RANKED_SOLO_5x5')


        const card = document.createElement('div')
        card.className = 'player-card'
        card.innerHTML = `
        <h2>${name}#${tag}</h2>
        <h3>Solo/Duo</h3>
        <p>Rank: ${solo ? `${solo.tier} ${solo.rank}` : 'Unranked'}</p>
        <p>LP: ${solo ? solo.leaguePoints : 0}</p>
        <p>Wins: ${solo ? solo.wins : 0} | Losses: ${solo ? solo.losses : 0}</p>`


        document.getElementById('result').appendChild(card)
    }

    loadPlayers()
}
