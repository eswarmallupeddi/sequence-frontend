const backendUrl = "https://family-dry-championship-wan.trycloudflare.com"; 
const socket = io(backendUrl);

socket.on('connect', () => console.log("🟢 Frontend connected!"));

// --- DOM Elements ---
const landingScreen = document.getElementById('landing-screen');
const nameScreen = document.getElementById('name-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const sequenceScreen = document.getElementById('sequence-screen');
const unoScreen = document.getElementById('uno-screen');
const daadiScreen = document.getElementById('daadi-screen');

const selectSequenceBtn = document.getElementById('select-sequence');
const selectUnoBtn = document.getElementById('select-uno');
const selectDaadiBtn = document.getElementById('select-daadi');
const gameTitleDisplay = document.getElementById('game-title-display');
const nicknameInput = document.getElementById('nickname');
const submitNameBtn = document.getElementById('submit-name');
const shareLinkInput = document.getElementById('share-link');
const startGameBtn = document.getElementById('start-game-btn');
const rematchBtns = document.querySelectorAll('.rematch-btn');
const colorPickerModal = document.getElementById('color-picker-modal');

let myName = ""; let myRoomId = ""; let myGameType = ""; let isGameOver = false;

// URL Routing
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room') && urlParams.get('game')) {
    myRoomId = urlParams.get('room'); myGameType = urlParams.get('game');
    landingScreen.classList.remove('active'); nameScreen.classList.add('active');
    gameTitleDisplay.innerText = `Join ${myGameType === 'uno' ? 'Color Match' : myGameType === 'daadi' ? 'Daadi' : 'Sequence'}`;
} else myRoomId = Math.random().toString(36).substring(2, 9);

selectSequenceBtn.addEventListener('click', () => setGameType('sequence', 'Join Sequence'));
selectUnoBtn.addEventListener('click', () => setGameType('uno', 'Join Color Match'));
selectDaadiBtn.addEventListener('click', () => setGameType('daadi', 'Join Daadi'));

function setGameType(type, title) {
    myGameType = type; landingScreen.classList.remove('active'); nameScreen.classList.add('active');
    gameTitleDisplay.innerText = title; window.history.pushState({}, '', `?game=${myGameType}&room=${myRoomId}`);
}

submitNameBtn.addEventListener('click', () => {
    myName = nicknameInput.value.trim(); if (!myName) return alert("Enter nickname!");
    nameScreen.classList.remove('active'); lobbyScreen.classList.add('active');
    shareLinkInput.value = `${window.location.origin}${window.location.pathname}?game=${myGameType}&room=${myRoomId}`;
    
    // Toggle Lobby Layout based on Game Type
    if (myGameType === 'sequence') {
        document.getElementById('lobby-teams').style.display = 'flex';
        document.getElementById('lobby-ffa').style.display = 'none';
        document.getElementById('randomize-btn').style.display = 'inline-block';
    } else {
        document.getElementById('lobby-teams').style.display = 'none';
        document.getElementById('lobby-ffa').style.display = 'block';
        document.getElementById('randomize-btn').style.display = 'none'; // No teams to randomize
    }

    socket.emit('joinRoom', { roomId: myRoomId, nickname: myName, gameType: myGameType });
});

document.getElementById('copy-btn').addEventListener('click', () => { shareLinkInput.select(); document.execCommand('copy'); });

// --- Lobby Logic ---
const dropzones = { 'blue': document.getElementById('blue-dropzone'), 'red': document.getElementById('red-dropzone'), 'green': document.getElementById('green-dropzone'), 'ffa': document.getElementById('ffa-dropzone') };

Object.keys(dropzones).forEach(key => {
    if(!dropzones[key]) return;
    dropzones[key].addEventListener('dragover', e => e.preventDefault());
    dropzones[key].addEventListener('drop', e => {
        e.preventDefault(); if (myGameType !== 'sequence') return;
        socket.emit('updateTeams', { roomId: myRoomId, updatedPlayers: [{ name: e.dataTransfer.getData('text/plain'), team: key }] });
    });
});

socket.on('lobbyUpdate', (players) => {
    Object.values(dropzones).forEach(z => { if(z) z.innerHTML = ''; });
    players.forEach(p => {
        if (p.name === myName) startGameBtn.style.display = p.isHost ? "block" : "none";
        const tag = document.createElement('div'); tag.className = 'player-tag'; tag.innerText = p.name + (p.name === myName ? " (You)" : "");
        
        if (myGameType === 'sequence') {
            tag.setAttribute('draggable', 'true'); tag.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', p.name));
            (dropzones[p.team] || dropzones['blue']).appendChild(tag);
        } else {
            dropzones['ffa'].appendChild(tag);
        }
    });
});

document.getElementById('randomize-btn').addEventListener('click', () => socket.emit('randomizeTeams', { roomId: myRoomId }));
startGameBtn.addEventListener('click', () => socket.emit('startGame', { roomId: myRoomId }));
rematchBtns.forEach(btn => btn.addEventListener('click', () => socket.emit('rematch', { roomId: myRoomId })));

// --- Global Game Router ---
socket.on('gameState', (data) => {
    lobbyScreen.classList.remove('active'); isGameOver = data.isGameOver || false;
    if (data.gameType === 'sequence') { sequenceScreen.classList.add('active'); renderSequence(data); } 
    else if (data.gameType === 'uno') { unoScreen.classList.add('active'); renderUno(data); }
    else if (data.gameType === 'daadi') { daadiScreen.classList.add('active'); renderDaadi(data); }
});

socket.on('gameOver', (msg) => alert(`GAME OVER! ${msg}`));

// --- Sequence Render (Truncated for brevity, remains unchanged from previous implementation) ---
let seqSelectedCard = null;
function renderSequence(data) {
    const turnInd = document.getElementById('seq-turn-indicator'); const rematchBtn = sequenceScreen.querySelector('.rematch-btn');
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; rematchBtn.style.display = "block"; } 
    else { rematchBtn.style.display = "none"; turnInd.innerText = data.turnPlayer === myName ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`; turnInd.style.background = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' }[data.turnTeam] || '#444'; }
    if(data.scores) { document.getElementById('score-red').innerText = data.scores.red; document.getElementById('score-blue').innerText = data.scores.blue; document.getElementById('score-green').innerText = data.scores.green; }
    document.getElementById('seq-cards-left').innerText = data.cardsLeft; const discardEl = document.getElementById('seq-last-discarded'); discardEl.innerHTML = '';
    if (data.lastDiscards) data.lastDiscards.forEach(c => { const img = document.createElement('img'); img.src = getSeqImageUrl(c); img.className = 'discarded-card'; discardEl.appendChild(img); });
    const boardEl = document.getElementById('board'); boardEl.innerHTML = '';
    data.board.forEach((space, i) => {
        const div = document.createElement('div'); div.classList.add('board-space');
        if (space.card === 'FREE') { div.style.background = '#ff477e'; div.innerHTML = '<span style="color:white; font-weight:bold;">FREE</span>'; } 
        else { const img = document.createElement('img'); img.src = getSeqImageUrl(space.card); img.className = 'card-img'; div.appendChild(img); }
        if (space.team) { const chip = document.createElement('div'); chip.style.backgroundColor = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' }[space.team]; chip.style.width = "45px"; chip.style.height = "45px"; chip.style.borderRadius = "50%"; chip.style.position = "absolute"; chip.style.border = space.locked ? "4px solid gold" : "4px dashed white"; div.appendChild(chip); }
        div.addEventListener('click', () => { if (isGameOver || !seqSelectedCard) return; socket.emit('playMove', { roomId: myRoomId, username: myName, boardIndex: i, cardPlayed: seqSelectedCard }); }); boardEl.appendChild(div);
    });
    const handEl = document.getElementById('seq-hand'); handEl.innerHTML = '';
    data.hand.forEach(card => {
        const img = document.createElement('img'); img.src = getSeqImageUrl(card); img.className = 'hand-card';
        img.addEventListener('click', () => { Array.from(handEl.children).forEach(c => c.style.border = "none"); img.style.border = "3px solid #0de0d8"; seqSelectedCard = card; }); handEl.appendChild(img);
    });
}
function getSeqImageUrl(c) { if (c === 'FREE') return ''; let p = c.split('-'); let s = p[0] === '♠'?'S':p[0] === '♥'?'H':p[0] === '♣'?'C':'D'; let r = p[1] === '10'?'0':p[1]; return `https://deckofcardsapi.com/static/img/${r}${s}.png`; }

// --- Uno Render (Truncated, remains unchanged) ---
let pendingUnoCard = null;
function renderUno(data) {
    const turnInd = document.getElementById('uno-turn-indicator'); const rematchBtn = unoScreen.querySelector('.rematch-btn');
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; rematchBtn.style.display = "block"; } 
    else { rematchBtn.style.display = "none"; turnInd.innerText = data.turnPlayer === myName ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`; turnInd.style.background = data.turnPlayer === myName ? "#0de0d8" : "#444"; }
    const oppEl = document.getElementById('uno-opponents'); oppEl.innerHTML = '';
    data.playerList.forEach(p => { if (p.name === myName) return; const div = document.createElement('div'); div.className = 'uno-opponent'; div.innerHTML = `${p.name}<br><span style="font-size:24px; color:#0de0d8">${p.cardCount}</span> cards`; oppEl.appendChild(div); });
    const discardPile = document.getElementById('uno-discard-pile'); discardPile.innerHTML = ''; if (data.topCard) discardPile.appendChild(createUnoCard(data.topCard));
    const handEl = document.getElementById('uno-hand'); handEl.innerHTML = '';
    data.hand.forEach(card => {
        const cardEl = createUnoCard(card);
        cardEl.addEventListener('click', () => {
            if (isGameOver || data.turnPlayer !== myName) return;
            if (card.color === 'black') { pendingUnoCard = card; colorPickerModal.classList.add('active'); } 
            else socket.emit('playUnoMove', { roomId: myRoomId, username: myName, card: card });
        });
        handEl.appendChild(cardEl);
    });
    document.getElementById('uno-draw-pile').onclick = () => { if (!isGameOver && data.turnPlayer === myName) socket.emit('drawUnoCard', { roomId: myRoomId, username: myName }); };
}
document.querySelectorAll('.color-btn').forEach(btn => { btn.addEventListener('click', (e) => { const chosen = e.target.getAttribute('data-color'); colorPickerModal.classList.remove('active'); if (pendingUnoCard) { socket.emit('playUnoMove', { roomId: myRoomId, username: myName, card: pendingUnoCard, chosenColor: chosen }); pendingUnoCard = null; } }); });
function createUnoCard(cardObj) { const el = document.createElement('div'); el.className = `uno-card ${cardObj.color}`; let displayVal = cardObj.value; if (displayVal === 'Skip') displayVal = '⊘'; if (displayVal === 'Rev') displayVal = '⇄'; if (displayVal === 'Wild') displayVal = 'W'; el.innerHTML = `<div class="uno-card-mini">${displayVal}</div><div class="uno-card-inner"><span class="uno-card-value">${displayVal}</span></div><div class="uno-card-mini bottom">${displayVal}</div>`; return el; }

// --- Daadi (9 Men's Morris) Render ---
let daadiSelectedNode = null;

// Node percentage coordinates [left, top] mapped precisely to the CSS geometry
const DAADI_COORDS = [
    [10,10], [50,10], [90,10], [90,50], [90,90], [50,90], [10,90], [10,50], // Outer
    [30,30], [50,30], [70,30], [70,50], [70,70], [50,70], [30,70], [30,50], // Mid
    [40,40], [50,40], [60,40], [60,50], [60,60], [50,60], [40,60], [40,50]  // Inner
];

function initDaadiBoard() {
    const container = document.getElementById('daadi-nodes');
    if (container.children.length > 0) return; // Already initialized
    
    // Add the true inner square border for aesthetics
    const innerBorder = document.createElement('div');
    innerBorder.className = 'daadi-line true-inner';
    document.getElementById('daadi-board-container').appendChild(innerBorder);

    for (let i = 0; i < 24; i++) {
        const node = document.createElement('div');
        node.className = 'daadi-node';
        node.style.left = `${DAADI_COORDS[i][0]}%`;
        node.style.top = `${DAADI_COORDS[i][1]}%`;
        node.dataset.index = i;
        
        node.addEventListener('click', () => handleDaadiClick(i));
        container.appendChild(node);
    }
}

let currentDaadiState = null;

function renderDaadi(data) {
    initDaadiBoard();
    currentDaadiState = data;
    
    const turnInd = document.getElementById('daadi-turn-indicator'); 
    const actionTxt = document.getElementById('daadi-action-text');
    const rematchBtn = daadiScreen.querySelector('.rematch-btn');
    const isMyTurn = data.turnPlayer === myName;
    const isRemoving = data.removingPlayer === myName;

    // Header updates
    if (isGameOver) { 
        turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; 
        actionTxt.innerText = ""; rematchBtn.style.display = "block"; 
    } else { 
        rematchBtn.style.display = "none"; 
        turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer}'s Turn`; 
        turnInd.style.background = isMyTurn ? "#0de0d8" : "#444"; 
        
        if (isMyTurn && isRemoving) actionTxt.innerText = "MILL FORMED! Remove an opponent's animal!";
        else if (isMyTurn && data.me.unplaced > 0) actionTxt.innerText = `Place a ${data.me.icon} on an empty spot.`;
        else if (isMyTurn && data.me.unplaced === 0) actionTxt.innerText = "Select your animal, then click an empty spot to move.";
        else actionTxt.innerText = "Wait for your turn...";
    }

    // Player List & Unplaced Tracker
    const playersEl = document.getElementById('daadi-players-list');
    playersEl.innerHTML = '';
    data.playersList.forEach(p => {
        playersEl.innerHTML += `<div style="margin-bottom:10px;">${p.icon} <b>${p.name}</b> <br><small>Unplaced: ${p.unplaced} | On Board: ${p.onBoard}</small></div>`;
    });

    // Board Nodes Update
    const nodes = document.getElementById('daadi-nodes').children;
    for (let i = 0; i < 24; i++) {
        nodes[i].innerText = data.board[i] || ""; // Insert animal emoji or clear
        nodes[i].classList.remove('selected', 'removing-target');
        
        // Visual cue for removing
        if (isMyTurn && isRemoving && data.board[i] && data.board[i] !== data.me.icon) {
            nodes[i].classList.add('removing-target');
        }
    }

    // Preserve selection highlight if selecting own piece to move
    if (daadiSelectedNode !== null && !isRemoving && nodes[daadiSelectedNode].innerText === data.me.icon) {
        nodes[daadiSelectedNode].classList.add('selected');
    } else {
        daadiSelectedNode = null; // Reset if invalid
    }
}

function handleDaadiClick(index) {
    if (isGameOver || currentDaadiState.turnPlayer !== myName) return;
    
    const isRemoving = currentDaadiState.removingPlayer === myName;
    const board = currentDaadiState.board;
    const myIcon = currentDaadiState.me.icon;

    if (isRemoving) {
        // Only allow clicking opponent's pieces
        if (board[index] && board[index] !== myIcon) {
            socket.emit('playDaadiMove', { roomId: myRoomId, username: myName, action: 'remove', index: index });
        }
        return;
    }

    if (currentDaadiState.me.unplaced > 0) {
        // Placement Phase
        if (!board[index]) {
            socket.emit('playDaadiMove', { roomId: myRoomId, username: myName, action: 'place', index: index });
        }
    } else {
        // Movement Phase
        if (board[index] === myIcon) {
            // Select piece
            daadiSelectedNode = index;
            renderDaadi(currentDaadiState); // Re-render to highlight
        } else if (!board[index] && daadiSelectedNode !== null) {
            // Attempt Move
            socket.emit('playDaadiMove', { roomId: myRoomId, username: myName, action: 'move', fromIndex: daadiSelectedNode, index: index });
            daadiSelectedNode = null;
        }
    }
}
