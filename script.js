// REPLACE THIS WITH YOUR SECURE CLOUDFLARE TUNNEL URL
const backendUrl = "https://tiny-chrome-cms-students.trycloudflare.com"; 
const socket = io(backendUrl);

// --- Tracers ---
socket.on('connect', () => console.log("🟢 SUCCESS: Frontend connected to the server!"));
socket.on('connect_error', (err) => console.log("🔴 ERROR: Failed to connect to server.", err));

// --- DOM Elements ---
const landingScreen = document.getElementById('landing-screen');
const nameScreen = document.getElementById('name-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

const selectSequenceBtn = document.getElementById('select-sequence');
const gameTitleDisplay = document.getElementById('game-title-display');
const nicknameInput = document.getElementById('nickname');
const submitNameBtn = document.getElementById('submit-name');
const shareLinkInput = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-btn');
const startGameBtn = document.getElementById('start-game-btn');
const rematchBtn = document.getElementById('rematch-btn');

const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const turnIndicator = document.getElementById('turn-indicator');
const lastDiscardedEl = document.getElementById('last-discarded');
const cardsLeftEl = document.getElementById('cards-left');

// --- State Variables ---
let myName = "";
let myRoomId = "";
let myGameType = "";
let isHost = false;
let selectedCard = null;
let isGameOver = false;

// --- URL Routing Logic ---
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
const gameFromUrl = urlParams.get('game');

if (roomFromUrl && gameFromUrl) {
    // Player used an invite link, skip landing page
    myRoomId = roomFromUrl;
    myGameType = gameFromUrl;
    landingScreen.classList.remove('active');
    nameScreen.classList.add('active');
    gameTitleDisplay.innerText = `Join ${myGameType.charAt(0).toUpperCase() + myGameType.slice(1)}`;
} else {
    // Player is host, show landing page
    myRoomId = Math.random().toString(36).substring(2, 9);
}

// Hub Selection
selectSequenceBtn.addEventListener('click', () => {
    myGameType = 'sequence';
    landingScreen.classList.remove('active');
    nameScreen.classList.add('active');
    gameTitleDisplay.innerText = "Join Sequence";
    // Update browser URL silently
    window.history.pushState({}, '', `?game=${myGameType}&room=${myRoomId}`);
});

// --- Join Lobby ---
submitNameBtn.addEventListener('click', () => {
    myName = nicknameInput.value.trim();
    if (!myName) return alert("Please enter a nickname!");

    nameScreen.classList.remove('active');
    lobbyScreen.classList.add('active');

    const inviteUrl = `${window.location.origin}${window.location.pathname}?game=${myGameType}&room=${myRoomId}`;
    shareLinkInput.value = inviteUrl;

    socket.emit('joinRoom', { roomId: myRoomId, nickname: myName, gameType: myGameType });
});

copyBtn.addEventListener('click', () => {
    shareLinkInput.select();
    document.execCommand('copy');
    copyBtn.innerText = "Copied!";
    setTimeout(() => copyBtn.innerText = "Copy", 2000);
});

// --- Drag and Drop Lobby Logic ---
const dropzones = {
    'blue': document.getElementById('blue-dropzone'),
    'red': document.getElementById('red-dropzone'),
    'green': document.getElementById('green-dropzone')
};

Object.keys(dropzones).forEach(teamColor => {
    const zone = dropzones[teamColor];
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over'); 
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const playerName = e.dataTransfer.getData('text/plain');
        socket.emit('updateTeams', { roomId: myRoomId, updatedPlayers: [{ name: playerName, team: teamColor }] });
    });
});

socket.on('lobbyUpdate', (players) => {
    Object.values(dropzones).forEach(zone => { if(zone) zone.innerHTML = ''; });

    players.forEach(p => {
        if (p.name === myName) {
            isHost = p.isHost;
            startGameBtn.style.display = isHost ? "block" : "none";
        }

        const playerTag = document.createElement('div');
        playerTag.className = 'player-tag';
        
        if (p.name === myName) {
            playerTag.innerHTML = `${p.name} (You)<br><small style="font-weight:normal; font-size: 0.8em;">(Tap to change)</small>`;
            playerTag.addEventListener('click', () => {
                const teams = ['blue', 'red', 'green'];
                const nextTeam = teams[(teams.indexOf(p.team) + 1) % teams.length];
                socket.emit('updateTeams', { roomId: myRoomId, updatedPlayers: [{ name: myName, team: nextTeam }] });
            });
        } else {
            playerTag.innerText = p.name;
        }
        
        playerTag.setAttribute('draggable', 'true');
        playerTag.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', p.name);
            e.dataTransfer.effectAllowed = 'move';
        });

        const targetZone = dropzones[p.team] || dropzones['blue'];
        if (targetZone) targetZone.appendChild(playerTag);
    });
});

document.querySelector('.outline-btn').addEventListener('click', () => socket.emit('randomizeTeams', { roomId: myRoomId }));

startGameBtn.addEventListener('click', () => socket.emit('startGame', { roomId: myRoomId }));
rematchBtn.addEventListener('click', () => socket.emit('rematch', { roomId: myRoomId }));

// --- Game Logic & Graphics ---

function getCardImageUrl(cardString) {
    if (cardString === 'FREE') return ''; 
    const parts = cardString.split('-');
    let suitChar = parts[0] === '♠' ? 'S' : parts[0] === '♥' ? 'H' : parts[0] === '♣' ? 'C' : 'D';
    let rankChar = parts[1] === '10' ? '0' : parts[1];
    return `https://deckofcardsapi.com/static/img/${rankChar}${suitChar}.png`;
}

socket.on('gameState', (data) => {
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');

    isGameOver = data.isGameOver || false;

    if (isGameOver) {
        turnIndicator.innerText = "GAME OVER";
        turnIndicator.style.background = "#222";
        turnIndicator.style.color = "white";
        rematchBtn.style.display = "block";
    } else {
        rematchBtn.style.display = "none";
        const isMyTurn = data.turnPlayer === myName;
        turnIndicator.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`;
        
        // Match the rich green here
        const turnColors = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' };
        turnIndicator.style.background = turnColors[data.turnTeam] || '#444';
        turnIndicator.style.color = 'white';
    }

    if (data.scores) {
        document.getElementById('score-red').innerText = data.scores.red;
        document.getElementById('score-blue').innerText = data.scores.blue;
        document.getElementById('score-green').innerText = data.scores.green;
    }

    if (data.cardsLeft !== undefined) cardsLeftEl.innerText = data.cardsLeft;
    if (data.lastDiscard) {
        lastDiscardedEl.innerHTML = `<img src="${getCardImageUrl(data.lastDiscard)}" class="card-img" style="width: 50px;">`;
    } else {
        lastDiscardedEl.innerHTML = '';
    }

    renderBoard(data.board);
    renderHand(data.hand);
    selectedCard = null; 
});

socket.on('gameOver', (winnerTeam) => {
    alert(`GAME OVER! ${winnerTeam.toUpperCase()} TEAM WINS!`);
});

function renderBoard(boardState) {
    boardEl.innerHTML = '';
    boardState.forEach((space, index) => {
        const div = document.createElement('div');
        div.classList.add('board-space');
        
        if (space.card === 'FREE') {
            div.style.background = '#ff477e';
            div.innerHTML = '<span style="color:white; font-weight:bold;">FREE</span>';
        } else {
            const img = document.createElement('img');
            img.src = getCardImageUrl(space.card);
            img.className = 'card-img';
            div.appendChild(img);
        }

        if (space.team) {
            const chip = document.createElement('div');
            const teamColors = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' };
            chip.style.backgroundColor = teamColors[space.team];
            chip.style.width = "45px";
            chip.style.height = "45px";
            chip.style.borderRadius = "50%";
            chip.style.position = "absolute";
            chip.style.boxShadow = "0 4px 6px rgba(0,0,0,0.5)";
            
            // Gold border for locked sequences
            chip.style.border = space.locked ? "4px solid gold" : "4px dashed white";
            div.appendChild(chip);
        }

        div.addEventListener('click', () => {
            if (isGameOver) return alert("The game is over! Play a rematch.");
            if (!selectedCard) return alert("Select a card from your hand first!");
            socket.emit('playMove', { roomId: myRoomId, username: myName, boardIndex: index, cardPlayed: selectedCard });
        });

        boardEl.appendChild(div);
    });
}

function renderHand(handArray) {
    handEl.innerHTML = '';
    handArray.forEach(card => {
        const img = document.createElement('img');
        img.src = getCardImageUrl(card);
        img.className = 'hand-card';
        
        img.addEventListener('click', () => {
            Array.from(handEl.children).forEach(c => {
                c.style.border = "none";
                c.style.transform = "none";
            });
            img.style.border = "3px solid #0de0d8";
            img.style.transform = "translateY(-10px)";
            selectedCard = card;
        });
        
        handEl.appendChild(img);
    });
}
