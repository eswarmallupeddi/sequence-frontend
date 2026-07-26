// REPLACE WITH YOUR SECURE CLOUDFLARE/ORACLE URL
const backendUrl = "https://gasoline-meetings-task-languages.trycloudflare.com"; 
const socket = io(backendUrl);

// DOM Elements
const landingPage = document.getElementById('landing-page');
const gamePage = document.getElementById('game-page');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const teamSelect = document.getElementById('team-select');
const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const turnIndicator = document.getElementById('turn-indicator');
const playerInfo = document.getElementById('player-info');

let myUsername = localStorage.getItem('sequence_username') || '';
let myTeam = localStorage.getItem('sequence_team') || '';
let selectedCard = null;

// Reconnection Logic: If they refreshed, instantly bypass landing page
if (myUsername && myTeam) {
    joinGame();
}

joinBtn.addEventListener('click', () => {
    myUsername = usernameInput.value.trim();
    myTeam = teamSelect.value;
    if (!myUsername) return alert("Please enter a name");
    
    // Save to local storage to survive page refreshes
    localStorage.setItem('sequence_username', myUsername);
    localStorage.setItem('sequence_team', myTeam);
    joinGame();
});

function joinGame() {
    landingPage.classList.remove('active');
    gamePage.classList.active = 'active';
    gamePage.style.display = 'flex';
    
    socket.emit('joinGame', { username: myUsername, team: myTeam });
    playerInfo.innerText = `${myUsername} - ${myTeam.toUpperCase()} TEAM`;
}

// Render the game state from the server
socket.on('gameState', (data) => {
    renderBoard(data.board);
    renderHand(data.hand);
    
    turnIndicator.innerText = `${data.turn}'s Turn`;
    turnIndicator.style.background = data.turn === 'red' ? '#d32f2f' : '#1e88e5';
    turnIndicator.style.color = 'white';
    
    // Clear selection
    selectedCard = null;
});

socket.on('gameOver', (winnerTeam) => {
    alert(`GAME OVER! The ${winnerTeam.toUpperCase()} team has formed a Sequence!`);
});

function getSuitColorClass(cardString) {
    if (cardString.includes('♥') || cardString.includes('♦')) return 'red-suit';
    return 'black-suit';
}

function renderBoard(boardState) {
    boardEl.innerHTML = '';
    boardState.forEach((space, index) => {
        const div = document.createElement('div');
        div.classList.add('board-space');
        
        if (space.card === 'FREE') {
            div.classList.add('free');
            div.innerText = 'FREE';
        } else {
            div.classList.add(getSuitColorClass(space.card));
            div.innerText = space.card;
        }

        // Draw chips
        if (space.team) {
            const chip = document.createElement('div');
            chip.className = `chip ${space.team}`;
            div.appendChild(chip);
        }

        // Handle clicking a board space
        div.addEventListener('click', () => {
            if (!selectedCard) return alert("Select a card from your hand first!");
            socket.emit('playMove', {
                username: myUsername,
                boardIndex: index,
                cardPlayed: selectedCard
            });
        });

        boardEl.appendChild(div);
    });
}

function renderHand(handArray) {
    handEl.innerHTML = '';
    handArray.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `hand-card ${getSuitColorClass(card)}`;
        cardDiv.innerText = card;
        
        cardDiv.addEventListener('click', () => {
            // Remove selection styling from all cards
            document.querySelectorAll('.hand-card').forEach(c => c.classList.remove('selected'));
            // Select this card
            cardDiv.classList.add('selected');
            selectedCard = card;
        });
        
        handEl.appendChild(cardDiv);
    });
}
