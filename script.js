const backendUrl = "https://spears-info-morris-portrait.trycloudflare.com"; 
const socket = io(backendUrl);

socket.on('connect', () => console.log("🟢 Frontend connected!"));

// --- DOM Elements ---
const landingScreen = document.getElementById('landing-screen');
const nameScreen = document.getElementById('name-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const sequenceScreen = document.getElementById('sequence-screen');
const unoScreen = document.getElementById('uno-screen');

const selectSequenceBtn = document.getElementById('select-sequence');
const selectUnoBtn = document.getElementById('select-uno');
const gameTitleDisplay = document.getElementById('game-title-display');
const nicknameInput = document.getElementById('nickname');
const submitNameBtn = document.getElementById('submit-name');
const shareLinkInput = document.getElementById('share-link');
const startGameBtn = document.getElementById('start-game-btn');
const rematchBtns = document.querySelectorAll('.rematch-btn');
const colorPickerModal = document.getElementById('color-picker-modal');

let myName = "";
let myRoomId = "";
let myGameType = "";
let isGameOver = false;
let selectedCard = null; // Used for Sequence

// URL Routing
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room') && urlParams.get('game')) {
    myRoomId = urlParams.get('room');
    myGameType = urlParams.get('game');
    landingScreen.classList.remove('active');
    nameScreen.classList.add('active');
    gameTitleDisplay.innerText = `Join ${myGameType === 'uno' ? 'Color Match' : 'Sequence'}`;
} else {
    myRoomId = Math.random().toString(36).substring(2, 9);
}

selectSequenceBtn.addEventListener('click', () => setGameType('sequence', 'Join Sequence'));
selectUnoBtn.addEventListener('click', () => setGameType('uno', 'Join Color Match'));

function setGameType(type, title) {
    myGameType = type;
    landingScreen.classList.remove('active');
    nameScreen.classList.add('active');
    gameTitleDisplay.innerText = title;
    window.history.pushState({}, '', `?game=${myGameType}&room=${myRoomId}`);
}

submitNameBtn.addEventListener('click', () => {
    myName = nicknameInput.value.trim();
    if (!myName) return alert("Enter nickname!");
    nameScreen.classList.remove('active');
    lobbyScreen.classList.add('active');
    shareLinkInput.value = `${window.location.origin}${window.location.pathname}?game=${myGameType}&room=${myRoomId}`;
    socket.emit('joinRoom', { roomId: myRoomId, nickname: myName, gameType: myGameType });
});

document.getElementById('copy-btn').addEventListener('click', () => {
    shareLinkInput.select(); document.execCommand('copy');
});

// --- Lobby Logic ---
const dropzones = { 'blue': document.getElementById('blue-dropzone'), 'red': document.getElementById('red-dropzone'), 'green': document.getElementById('green-dropzone') };

Object.keys(dropzones).forEach(color => {
    dropzones[color].addEventListener('dragover', e => e.preventDefault());
    dropzones[color].addEventListener('drop', e => {
        e.preventDefault();
        socket.emit('updateTeams', { roomId: myRoomId, updatedPlayers: [{ name: e.dataTransfer.getData('text/plain'), team: color }] });
    });
});

socket.on('lobbyUpdate', (players) => {
    Object.values(dropzones).forEach(z => z.innerHTML = '');
    players.forEach(p => {
        if (p.name === myName) startGameBtn.style.display = p.isHost ? "block" : "none";
        const tag = document.createElement('div');
        tag.className = 'player-tag';
        tag.innerText = p.name + (p.name === myName ? " (You)" : "");
        tag.setAttribute('draggable', 'true');
        tag.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', p.name));
        (dropzones[p.team] || dropzones['blue']).appendChild(tag);
    });
});

document.querySelector('.outline-btn').addEventListener('click', () => socket.emit('randomizeTeams', { roomId: myRoomId }));
startGameBtn.addEventListener('click', () => socket.emit('startGame', { roomId: myRoomId }));
rematchBtns.forEach(btn => btn.addEventListener('click', () => socket.emit('rematch', { roomId: myRoomId })));

// --- Global Game Router ---
socket.on('gameState', (data) => {
    lobbyScreen.classList.remove('active');
    isGameOver = data.isGameOver || false;

    if (data.gameType === 'sequence') {
        sequenceScreen.classList.add('active');
        renderSequence(data);
    } else if (data.gameType === 'uno') {
        unoScreen.classList.add('active');
        renderUno(data);
    }
});

socket.on('gameOver', (msg) => alert(`GAME OVER! ${msg}`));

// --- Sequence Logic ---
function renderSequence(data) {
    const turnInd = document.getElementById('seq-turn-indicator');
    const rematchBtn = sequenceScreen.querySelector('.rematch-btn');
    
    if (isGameOver) {
        turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; rematchBtn.style.display = "block";
    } else {
        rematchBtn.style.display = "none";
        turnInd.innerText = data.turnPlayer === myName ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`;
        const colors = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' };
        turnInd.style.background = colors[data.turnTeam] || '#444';
    }

    if(data.scores) {
        document.getElementById('score-red').innerText = data.scores.red;
        document.getElementById('score-blue').innerText = data.scores.blue;
        document.getElementById('score-green').innerText = data.scores.green;
    }
    
    document.getElementById('seq-cards-left').innerText = data.cardsLeft;
    const discardEl = document.getElementById('seq-last-discarded');
    discardEl.innerHTML = '';
    if (data.lastDiscards) {
        data.lastDiscards.forEach(c => {
            const img = document.createElement('img'); img.src = getCardImageUrl(c); img.className = 'discarded-card';
            discardEl.appendChild(img);
        });
    }

    const boardEl = document.getElementById('board'); boardEl.innerHTML = '';
    data.board.forEach((space, i) => {
        const div = document.createElement('div'); div.classList.add('board-space');
        if (space.card === 'FREE') { div.style.background = '#ff477e'; div.innerHTML = '<span style="color:white; font-weight:bold;">FREE</span>'; } 
        else { const img = document.createElement('img'); img.src = getCardImageUrl(space.card); img.className = 'card-img'; div.appendChild(img); }

        if (space.team) {
            const chip = document.createElement('div');
            chip.style.backgroundColor = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' }[space.team];
            chip.style.width = "45px"; chip.style.height = "45px"; chip.style.borderRadius = "50%"; chip.style.position = "absolute";
            chip.style.border = space.locked ? "4px solid gold" : "4px dashed white"; div.appendChild(chip);
        }
        div.addEventListener('click', () => {
            if (isGameOver || !selectedCard) return;
            socket.emit('playMove', { roomId: myRoomId, username: myName, boardIndex: i, cardPlayed: selectedCard });
        });
        boardEl.appendChild(div);
    });

    const handEl = document.getElementById('seq-hand'); handEl.innerHTML = '';
    data.hand.forEach(card => {
        const img = document.createElement('img'); img.src = getCardImageUrl(card); img.className = 'hand-card';
        img.addEventListener('click', () => {
            Array.from(handEl.children).forEach(c => c.style.border = "none");
            img.style.border = "3px solid #0de0d8"; selectedCard = card;
        });
        handEl.appendChild(img);
    });
}

function getCardImageUrl(c) {
    if (c === 'FREE') return ''; 
    let parts = c.split('-'); let s = parts[0] === '♠'?'S':parts[0] === '♥'?'H':parts[0] === '♣'?'C':'D';
    let r = parts[1] === '10'?'0':parts[1]; return `https://deckofcardsapi.com/static/img/${r}${s}.png`;
}

// --- UNO Logic ---
let pendingUnoCard = null;

function renderUno(data) {
    const turnInd = document.getElementById('uno-turn-indicator');
    const rematchBtn = unoScreen.querySelector('.rematch-btn');

    if (isGameOver) {
        turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; rematchBtn.style.display = "block";
    } else {
        rematchBtn.style.display = "none";
        turnInd.innerText = data.turnPlayer === myName ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`;
        turnInd.style.background = data.turnPlayer === myName ? "#0de0d8" : "#444";
    }

    // Opponents
    const oppEl = document.getElementById('uno-opponents'); oppEl.innerHTML = '';
    data.playerList.forEach(p => {
        if (p.name === myName) return;
        const div = document.createElement('div'); div.className = 'uno-opponent';
        div.innerHTML = `${p.name}<br><span style="font-size:24px; color:#0de0d8">${p.cardCount}</span> cards`;
        oppEl.appendChild(div);
    });

    // Top Card
    const discardPile = document.getElementById('uno-discard-pile'); discardPile.innerHTML = '';
    if (data.topCard) discardPile.appendChild(createUnoCard(data.topCard));

    // My Hand
    const handEl = document.getElementById('uno-hand'); handEl.innerHTML = '';
    data.hand.forEach(card => {
        const cardEl = createUnoCard(card);
        cardEl.addEventListener('click', () => {
            if (isGameOver || data.turnPlayer !== myName) return;
            if (card.color === 'black') {
                pendingUnoCard = card;
                colorPickerModal.classList.add('active');
            } else {
                socket.emit('playUnoMove', { roomId: myRoomId, username: myName, card: card });
            }
        });
        handEl.appendChild(cardEl);
    });

    document.getElementById('uno-draw-pile').onclick = () => {
        if (!isGameOver && data.turnPlayer === myName) socket.emit('drawUnoCard', { roomId: myRoomId, username: myName });
    };
}

// Handle Color Picker
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const chosen = e.target.getAttribute('data-color');
        colorPickerModal.classList.remove('active');
        if (pendingUnoCard) {
            socket.emit('playUnoMove', { roomId: myRoomId, username: myName, card: pendingUnoCard, chosenColor: chosen });
            pendingUnoCard = null;
        }
    });
});

function createUnoCard(cardObj) {
    const el = document.createElement('div');
    el.className = `uno-card ${cardObj.color}`;
    let displayVal = cardObj.value;
    if (displayVal === 'Skip') displayVal = '⊘';
    if (displayVal === 'Rev') displayVal = '⇄';
    if (displayVal === '+2') displayVal = '+2';
    if (displayVal === 'Wild') displayVal = 'W';
    if (displayVal === '+4') displayVal = '+4';

    el.innerHTML = `
        <div class="uno-card-mini">${displayVal}</div>
        <div class="uno-card-inner"><span class="uno-card-value">${displayVal}</span></div>
        <div class="uno-card-mini bottom">${displayVal}</div>
    `;
    return el;
}
