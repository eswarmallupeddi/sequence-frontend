// REPLACE WITH YOUR SECURE CLOUDFLARE/ORACLE URL
const backendUrl = "https://gasoline-meetings-task-languages.trycloudflare.com"; 
const socket = io(backendUrl);

// DOM Elements
const landingPage = document.getElementById('landing-page');
const lobbyPage = document.getElementById('lobby-page'); // New
const gamePage = document.getElementById('game-page');
const joinBtn = document.getElementById('join-btn');
const startGameBtn = document.getElementById('start-game-btn'); // New
const usernameInput = document.getElementById('username');
const teamSelect = document.getElementById('team-select');
const playerList = document.getElementById('player-list'); // New
const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const turnIndicator = document.getElementById('turn-indicator');
const playerInfo = document.getElementById('player-info');

let myUsername = localStorage.getItem('sequence_username') || '';
let myTeam = localStorage.getItem('sequence_team') || '';
let selectedCard = null;

if (myUsername && myTeam) {
    joinGame(); // Auto-reconnect if they refresh
}

joinBtn.addEventListener('click', () => {
    myUsername = usernameInput.value.trim();
    myTeam = teamSelect.value;
    if (!myUsername) return alert("Please enter a name");
    
    localStorage.setItem('sequence_username', myUsername);
    localStorage.setItem('sequence_team', myTeam);
    joinGame();
});

function joinGame() {
    landingPage.classList.remove('active');
    lobbyPage.classList.add('active'); // Send to lobby first
    
    socket.emit('joinGame', { username: myUsername, team: myTeam });
}

// Render the Lobby
socket.on('lobbyUpdate', (players) => {
    playerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = `${p.name} - ${p.team.toUpperCase()} TEAM`;
        li.style.color = p.team === 'red' ? '#d32f2f' : '#1e88e5';
        li.style.fontWeight = 'bold';
        playerList.appendChild(li);
    });
});

// Start the Game
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

// Render the Game State (Fires when someone clicks Start Game)
socket.on('gameState', (data) => {
    lobbyPage.classList.remove('active');
    gamePage.classList.add('active'); // Fixed typo here!
    
    playerInfo.innerText = `${myUsername} - ${myTeam.toUpperCase()} TEAM`;
    renderBoard(data.board);
    renderHand(data.hand);
    
    turnIndicator.innerText = `${data.turn}'s Turn`;
    turnIndicator.style.background = data.turn === 'red' ? '#d32f2f' : '#1e88e5';
    turnIndicator.style.color = 'white';
    
    selectedCard = null;
});

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
