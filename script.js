const backendUrl = "https://excitement-person-controls-harder.trycloudflare.com"; 


const socket = io(backendUrl);

socket.on('connect', () => console.log("🟢 Frontend connected!"));

// Fetch Dog Pic for Lobby
fetch('https://dog.ceo/api/breeds/image/random')
    .then(res => res.json())
    .then(data => document.getElementById('lobby-dog-img').src = data.message)
    .catch(() => document.getElementById('lobby-dog-img').src = 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Card_back_01.svg');

// DOM Elements
const landingScreen = document.getElementById('landing-screen'); 
const nameScreen = document.getElementById('name-screen'); 
const lobbyScreen = document.getElementById('lobby-screen');
const turnSound = document.getElementById('turn-sound'); 
const slideSound = document.getElementById('slide-sound'); 
const ladderSound = document.getElementById('ladder-sound');

let myName = ""; let myRoomId = ""; let myGameType = ""; let isGameOver = false; let previousTurnPlayer = "";

// URL Routing
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room') && urlParams.get('game')) {
    myRoomId = urlParams.get('room'); myGameType = urlParams.get('game');
    landingScreen.classList.remove('active'); nameScreen.classList.add('active');
    document.getElementById('game-title-display').innerText = `Join Game`;
} else myRoomId = Math.random().toString(36).substring(2, 9);

['sequence', 'uno', 'daadi', 'daadi11', 'daadi11nd', 'phase10', 'snakes', 'ludo', 'sudoku'].forEach(game => {
    const btn = document.getElementById(`select-${game}`);
    if (btn) btn.addEventListener('click', () => {
        if(game === 'sudoku') { 
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('sudoku-screen').classList.add('active');
            loadSudoku('easy');
        } else {
            myGameType = game; landingScreen.classList.remove('active'); nameScreen.classList.add('active');
            window.history.pushState({}, '', `?game=${myGameType}&room=${myRoomId}`);
        }
    });
});

document.getElementById('submit-name').addEventListener('click', () => {
    myName = document.getElementById('nickname').value.trim(); if (!myName) return alert("Enter nickname!");
    nameScreen.classList.remove('active'); lobbyScreen.classList.add('active');
    document.getElementById('share-link').value = `${window.location.origin}${window.location.pathname}?game=${myGameType}&room=${myRoomId}`;
    
    if (myGameType === 'sequence') {
        document.getElementById('lobby-teams').style.display = 'flex'; document.getElementById('lobby-ffa').style.display = 'none'; document.getElementById('randomize-btn').style.display = 'inline-block';
    } else {
        document.getElementById('lobby-teams').style.display = 'none'; document.getElementById('lobby-ffa').style.display = 'block'; document.getElementById('randomize-btn').style.display = 'none';
    }
    socket.emit('joinRoom', { roomId: myRoomId, nickname: myName, gameType: myGameType });
});
document.getElementById('copy-btn').addEventListener('click', () => { document.getElementById('share-link').select(); document.execCommand('copy'); });

// Lobby Logic
const dropzones = { 'blue': document.getElementById('blue-dropzone'), 'red': document.getElementById('red-dropzone'), 'green': document.getElementById('green-dropzone'), 'ffa': document.getElementById('ffa-dropzone') };
Object.keys(dropzones).forEach(key => {
    if(!dropzones[key]) return;
    dropzones[key].addEventListener('dragover', e => e.preventDefault());
    dropzones[key].addEventListener('drop', e => { e.preventDefault(); if (myGameType === 'sequence') socket.emit('updateTeams', { roomId: myRoomId, updatedPlayers: [{ name: e.dataTransfer.getData('text/plain'), team: key }] }); });
});
socket.on('lobbyUpdate', (players) => {
    Object.values(dropzones).forEach(z => { if(z) z.innerHTML = ''; });
    players.forEach(p => {
        if (p.name === myName) document.getElementById('start-game-btn').style.display = p.isHost ? "block" : "none";
        const tag = document.createElement('div'); tag.className = 'player-tag'; tag.innerText = p.name + (p.name === myName ? " (You)" : "");
        if (myGameType === 'sequence') { tag.setAttribute('draggable', 'true'); tag.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', p.name)); (dropzones[p.team] || dropzones['blue']).appendChild(tag); } 
        else dropzones['ffa'].appendChild(tag);
    });
});
document.getElementById('randomize-btn').addEventListener('click', () => socket.emit('randomizeTeams', { roomId: myRoomId }));
document.getElementById('start-game-btn').addEventListener('click', () => socket.emit('startGame', { roomId: myRoomId }));
document.querySelectorAll('.rematch-btn').forEach(btn => btn.addEventListener('click', () => socket.emit('rematch', { roomId: myRoomId })));

// Global Game Router
socket.on('gameState', (data) => {
    lobbyScreen.classList.remove('active'); isGameOver = data.isGameOver || false;
    const isMyTurn = data.turnPlayer === myName;
    if (isMyTurn && previousTurnPlayer !== myName && !isGameOver) { turnSound.currentTime = 0; turnSound.play().catch(e=>{}); }
    previousTurnPlayer = data.turnPlayer;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (data.gameType === 'sequence') { document.getElementById('sequence-screen').classList.add('active'); renderSequence(data, isMyTurn); } 
    else if (data.gameType === 'uno') { document.getElementById('uno-screen').classList.add('active'); renderUno(data, isMyTurn); }
    else if (data.gameType.includes('daadi')) { document.getElementById('daadi-screen').classList.add('active'); renderDaadi(data, isMyTurn); }
    else if (data.gameType === 'phase10') { document.getElementById('phase10-screen').classList.add('active'); renderPhase10(data, isMyTurn); }
    else if (data.gameType === 'snakes') { document.getElementById('snakes-screen').classList.add('active'); renderSnakes(data, isMyTurn); }
    else if (data.gameType === 'ludo') { document.getElementById('ludo-screen').classList.add('active'); renderLudo(data, isMyTurn); }
});
socket.on('gameOver', (msg) => alert(`GAME OVER! ${msg}`));

// --- SEQUENCE RENDER ---
let seqSelectedCard = null;
function renderSequence(data, isMyTurn) {
    const turnInd = document.getElementById('seq-turn-indicator'); const rematchBtn = document.querySelector('#sequence-screen .rematch-btn');
    turnInd.className = 'turn-indicator'; 
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; rematchBtn.style.display = "block"; turnInd.style.color="white"; } 
    else { 
        rematchBtn.style.display = "none"; turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`; 
        if (isMyTurn) turnInd.classList.add('my-turn-pulse');
        else { turnInd.style.background = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#27ae60' }[data.turnTeam] || '#444'; turnInd.style.color="white"; }
    }
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

// --- COLOR MATCH RENDER ---
let pendingUnoCard = null;
function renderUno(data, isMyTurn) {
    const turnInd = document.getElementById('uno-turn-indicator'); const rematchBtn = document.querySelector('#uno-screen .rematch-btn');
    turnInd.className = 'turn-indicator'; 
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; rematchBtn.style.display = "block"; turnInd.style.color="white"; } 
    else { 
        rematchBtn.style.display = "none"; turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`; 
        if (isMyTurn) turnInd.classList.add('my-turn-pulse');
        else { turnInd.style.background = "#444"; turnInd.style.color = "white"; }
    }
    const stackAlert = document.getElementById('uno-draw-stack-alert');
    if (data.drawStack > 0) stackAlert.innerText = `Pending +${data.drawStack}`; else stackAlert.innerText = '';

    const oppEl = document.getElementById('uno-opponents'); oppEl.innerHTML = '';
    data.playerList.forEach(p => { if (p.name === myName) return; const div = document.createElement('div'); div.className = 'uno-opponent'; div.innerHTML = `${p.name}<br><span style="font-size:24px; color:#0de0d8">${p.cardCount}</span> cards`; oppEl.appendChild(div); });
    const discardPile = document.getElementById('uno-discard-pile'); discardPile.innerHTML = ''; if (data.topCard) discardPile.appendChild(createUnoCard(data.topCard));
    const handEl = document.getElementById('uno-hand'); handEl.innerHTML = '';
    data.hand.forEach(card => {
        const cardEl = createUnoCard(card);
        cardEl.addEventListener('click', () => {
            if (isGameOver || !isMyTurn) return;
            if (card.color === 'black') { pendingUnoCard = card; document.getElementById('color-picker-modal').classList.add('active'); } 
            else socket.emit('playUnoMove', { roomId: myRoomId, username: myName, card: card });
        });
        handEl.appendChild(cardEl);
    });
    document.getElementById('uno-draw-pile').onclick = () => { if (!isGameOver && isMyTurn) socket.emit('drawUnoCard', { roomId: myRoomId, username: myName }); };
}
document.querySelectorAll('.color-btn').forEach(btn => { btn.addEventListener('click', (e) => { const chosen = e.target.getAttribute('data-color'); document.getElementById('color-picker-modal').classList.remove('active'); if (pendingUnoCard) { socket.emit('playUnoMove', { roomId: myRoomId, username: myName, card: pendingUnoCard, chosenColor: chosen }); pendingUnoCard = null; } }); });
function createUnoCard(cardObj) { const el = document.createElement('div'); el.className = `uno-card ${cardObj.color}`; let displayVal = cardObj.value; if (displayVal === 'Skip') displayVal = '⊘'; if (displayVal === 'Rev') displayVal = '⇄'; if (displayVal === 'Wild') displayVal = 'W'; el.innerHTML = `<div class="uno-card-mini">${displayVal}</div><div class="uno-card-inner"><span class="uno-card-value">${displayVal}</span></div><div class="uno-card-mini bottom">${displayVal}</div>`; return el; }

// --- DAADI & 11 MEN'S RENDER ---
let daadiSelectedNode = null;
const DAADI_COORDS = [ [10,10],[50,10],[90,10],[90,50],[90,90],[50,90],[10,90],[10,50],[30,30],[50,30],[70,30],[70,50],[70,70],[50,70],[30,70],[30,50],[40,40],[50,40],[60,40],[60,50],[60,60],[50,60],[40,60],[40,50] ];
function initDaadiBoard(gameType) {
    const container = document.getElementById('daadi-nodes'); if (container.children.length > 0) return;
    if (gameType === 'daadi11') document.getElementById('daadi-diagonals').style.display = 'block';
    else document.getElementById('daadi-diagonals').style.display = 'none';

    const innerBorder = document.createElement('div'); innerBorder.className = 'daadi-line true-inner'; document.getElementById('daadi-board-container').appendChild(innerBorder);
    for (let i = 0; i < 24; i++) {
        const node = document.createElement('div'); node.className = 'daadi-node'; node.style.left = `${DAADI_COORDS[i][0]}%`; node.style.top = `${DAADI_COORDS[i][1]}%`; node.dataset.index = i;
        node.addEventListener('click', () => handleDaadiClick(i)); container.appendChild(node);
    }
}
let currentDaadiState = null;
function renderDaadi(data, isMyTurn) {
    initDaadiBoard(data.gameType); currentDaadiState = data;
    const turnInd = document.getElementById('daadi-turn-indicator'); const actionTxt = document.getElementById('daadi-action-text'); const rematchBtn = document.querySelector('#daadi-screen .rematch-btn');
    const isRemoving = data.removingPlayer === myName;
    turnInd.className = 'turn-indicator';
    
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; turnInd.style.color = "white"; actionTxt.innerText = ""; rematchBtn.style.display = "block"; } 
    else { 
        rematchBtn.style.display = "none"; turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer}'s Turn`; 
        if (isMyTurn) turnInd.classList.add('my-turn-pulse'); else { turnInd.style.background = "#444"; turnInd.style.color = "white"; }
        
        if (isMyTurn && isRemoving) actionTxt.innerText = "MILL FORMED! Remove an opponent's piece!";
        else if (isMyTurn && data.me.unplaced > 0) actionTxt.innerText = `Place a ${data.me.icon} on an empty spot.`;
        else if (isMyTurn && data.me.unplaced === 0) actionTxt.innerText = "Select your piece, then click an empty spot to move.";
        else actionTxt.innerText = "Wait for your turn...";
    }
    const playersEl = document.getElementById('daadi-players-list'); playersEl.innerHTML = '';
    data.playersList.forEach(p => { playersEl.innerHTML += `<div style="margin-bottom:10px;">${p.icon} <b>${p.name}</b> <br><small>Unplaced: ${p.unplaced} | On Board: ${p.onBoard}</small></div>`; });
    const nodes = document.getElementById('daadi-nodes').children;
    for (let i = 0; i < 24; i++) {
        nodes[i].innerText = data.board[i] || ""; nodes[i].classList.remove('selected', 'removing-target');
        if (isMyTurn && isRemoving && data.board[i] && data.board[i] !== data.me.icon) nodes[i].classList.add('removing-target');
    }
    if (daadiSelectedNode !== null && !isRemoving && nodes[daadiSelectedNode].innerText === data.me.icon) nodes[daadiSelectedNode].classList.add('selected');
    else daadiSelectedNode = null;
}
function handleDaadiClick(index) {
    if (isGameOver || currentDaadiState.turnPlayer !== myName) return;
    const isRemoving = currentDaadiState.removingPlayer === myName; const board = currentDaadiState.board; const myIcon = currentDaadiState.me.icon;
    if (isRemoving) { if (board[index] && board[index] !== myIcon) socket.emit('playDaadiMove', { roomId: myRoomId, username: myName, action: 'remove', index: index }); return; }
    if (currentDaadiState.me.unplaced > 0) { if (!board[index]) socket.emit('playDaadiMove', { roomId: myRoomId, username: myName, action: 'place', index: index }); } 
    else { if (board[index] === myIcon) { daadiSelectedNode = index; renderDaadi(currentDaadiState, true); } else if (!board[index] && daadiSelectedNode !== null) { socket.emit('playDaadiMove', { roomId: myRoomId, username: myName, action: 'move', fromIndex: daadiSelectedNode, index: index }); daadiSelectedNode = null; } }
}

// --- PHASE RACE RENDER ---
let phase10SelectedCards = [];
function renderPhase10(data, isMyTurn) {
    const turnInd = document.getElementById('phase10-turn-indicator'); const rematchBtn = document.querySelector('#phase10-screen .rematch-btn');
    turnInd.className = 'turn-indicator';

    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; turnInd.style.color = "white"; rematchBtn.style.display = "block"; } 
    else { rematchBtn.style.display = "none"; turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer.toUpperCase()}'s Turn`; if (isMyTurn) turnInd.classList.add('my-turn-pulse'); else { turnInd.style.background = "#444"; turnInd.style.color = "white"; } }

    document.getElementById('phase10-target-desc').innerText = `Phase ${data.me.phase}: ${getPhaseDescription(data.me.phase)}`;

    const pListEl = document.getElementById('phase10-players-list'); pListEl.innerHTML = '';
    data.playerList.forEach(p => {
        const playerDiv = document.createElement('div'); playerDiv.style.marginBottom = "15px";
        playerDiv.innerHTML = `<b>${p.name}</b>: Phase ${p.phase} ${p.hasLaidPhase ? '✓' : ''}`;
        if (data.laidPhases && data.laidPhases[p.name]) {
            const tableCards = document.createElement('div'); tableCards.className = 'cards-grid'; tableCards.style.transform = "scale(0.8)"; tableCards.style.transformOrigin = "left center";
            data.laidPhases[p.name].forEach(c => {
                const cardEl = createPhaseCard(c);
                cardEl.onclick = () => { if (isMyTurn && data.me.hasLaidPhase && phase10SelectedCards.length === 1) { socket.emit('hitPhase10', { roomId: myRoomId, username: myName, targetUser: p.name, cardIndex: phase10SelectedCards[0] }); phase10SelectedCards = []; } };
                tableCards.appendChild(cardEl);
            });
            playerDiv.appendChild(tableCards);
        }
        pListEl.appendChild(playerDiv);
    });

    const discardPile = document.getElementById('phase10-discard-pile'); discardPile.innerHTML = '';
    if (data.topCard) discardPile.appendChild(createPhaseCard(data.topCard));

    document.getElementById('phase10-draw-pile').onclick = () => { if (!isGameOver && isMyTurn && !data.me.hasDrawn) socket.emit('drawPhase10', { roomId: myRoomId, username: myName, source: 'deck' }); };
    discardPile.onclick = () => { if (!isGameOver && isMyTurn && !data.me.hasDrawn && data.topCard) socket.emit('drawPhase10', { roomId: myRoomId, username: myName, source: 'discard' }); };

    const handEl = document.getElementById('phase10-hand'); handEl.innerHTML = '';
    data.hand.forEach((card, idx) => {
        const cardEl = createPhaseCard(card); if (phase10SelectedCards.includes(idx)) cardEl.classList.add('selected');
        cardEl.addEventListener('click', () => { if (phase10SelectedCards.includes(idx)) phase10SelectedCards = phase10SelectedCards.filter(i => i !== idx); else phase10SelectedCards.push(idx); renderPhase10(data, isMyTurn); });
        handEl.appendChild(cardEl);
    });

    document.getElementById('phase10-lay-btn').onclick = () => { if (!isGameOver && isMyTurn && data.me.hasDrawn && !data.me.hasLaidPhase) { socket.emit('layPhase10', { roomId: myRoomId, username: myName, selectedIndices: phase10SelectedCards }); phase10SelectedCards = []; } };
    document.getElementById('phase10-discard-btn').onclick = () => { if (!isGameOver && isMyTurn && data.me.hasDrawn && phase10SelectedCards.length === 1) { socket.emit('discardPhase10', { roomId: myRoomId, username: myName, cardIndex: phase10SelectedCards[0] }); phase10SelectedCards = []; } else if (phase10SelectedCards.length !== 1) alert("Select exactly 1 card to discard!"); };
}
function createPhaseCard(c) { const el = document.createElement('div'); el.className = `phase-card ${c.color}`; let val = c.value; if (val === 'Wild') val = 'W'; if (val === 'Skip') val = 'S'; el.innerHTML = `<div class="phase-card-inner">${val}</div>`; return el; }
function getPhaseDescription(phase) { const desc = [ "", "2 sets of 3", "1 set of 3 + 1 run of 4", "1 set of 4 + 1 run of 4", "1 run of 7", "1 run of 8", "1 run of 9", "2 sets of 4", "7 cards of 1 color", "1 set of 5 + 1 set of 2", "1 set of 5 + 1 set of 3" ]; return desc[phase] || ""; }

// --- SUDOKU (SOLO) ---
function loadSudoku(diff) {
    const board = document.getElementById('sudoku-board'); board.innerHTML = '';
    const puzzles = {
        'easy': "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
        'medium': "000000000000003085001020000000507000004000100090000000500000073002010000000040009",
        'hard': "000600400700003600000091080000000000050180003000306045040200060903000000020000100"
    };
    let grid = puzzles[diff].split('');
    grid.forEach(val => {
        const input = document.createElement('input'); input.type = "text"; input.maxLength = 1; input.className = 'sudoku-cell';
        if (val !== '0') { input.value = val; input.disabled = true; input.classList.add('fixed'); }
        input.oninput = (e) => { if(!/^[1-9]$/.test(e.target.value)) e.target.value = ''; };
        board.appendChild(input);
    });
}

// --- SNAKES & LADDERS (PARAMAPADA) ---
function renderSnakes(data, isMyTurn) {
    const board = document.getElementById('snakes-board');
    if (board.children.length === 0) {
        for(let i=100; i>=1; i--) {
            let row = Math.floor((i-1)/10);
            let displayNum = (row % 2 === 0) ? i : (row*10) + (10 - (i-1)%10);
            const cell = document.createElement('div'); cell.className = 'snake-cell'; cell.id = `sc-${displayNum}`; cell.innerText = displayNum;
            if ([16,47,49,56,62,64,87,93,95,98].includes(displayNum)) cell.innerText += ' 🐍';
            if ([1,4,9,21,28,36,51,71,80].includes(displayNum)) cell.innerText += ' 🪜';
            board.appendChild(cell);
        }
    }
    
    const turnInd = document.getElementById('snakes-turn-indicator'); turnInd.className = 'turn-indicator';
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; } 
    else { turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer}'s Turn`; if (isMyTurn) turnInd.classList.add('my-turn-pulse'); else turnInd.style.background = "#444"; }
    
    document.getElementById('snakes-dice').innerText = data.lastRoll ? `🎲 ${data.lastRoll}` : '🎲';
    document.getElementById('roll-dice-btn').onclick = () => { if(isMyTurn && !isGameOver) socket.emit('playSnakes', {roomId: myRoomId, username: myName}); };

    const list = document.getElementById('snakes-players-list'); list.innerHTML = '';
    const icons = ['🐸','🐼','🦊','🐵','🐯','🐰'];
    document.querySelectorAll('.snake-piece').forEach(e => e.remove());

    data.playerList.forEach((p, idx) => {
        let icon = icons[idx % icons.length];
        list.innerHTML += `<div>${icon} <b>${p.name}</b>: Box ${p.pos}</div>`;
        if (p.pos > 0) {
            const piece = document.createElement('div'); piece.className = 'snake-piece'; piece.innerText = icon;
            const targetCell = document.getElementById(`sc-${p.pos}`);
            if(targetCell) {
                targetCell.appendChild(piece);
                if (data.event === 'snake' && data.turnPlayer === p.name) slideSound.play().catch(e=>{});
                if (data.event === 'ladder' && data.turnPlayer === p.name) ladderSound.play().catch(e=>{});
            }
        }
    });
}

// --- LUDO ---
function renderLudo(data, isMyTurn) {
    const board = document.getElementById('ludo-board');
    if (board.children.length === 0) {
        for(let r=0; r<15; r++) {
            for(let c=0; c<15; c++) {
                const cell = document.createElement('div'); cell.className = 'ludo-cell'; cell.id = `lc-${r}-${c}`;
                if (r < 6 && c < 6) cell.classList.add('red-home');
                else if (r < 6 && c > 8) cell.classList.add('green-home');
                else if (r > 8 && c < 6) cell.classList.add('blue-home');
                else if (r > 8 && c > 8) cell.classList.add('yellow-home');
                else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) cell.classList.add('center-box');
                board.appendChild(cell);
            }
        }
    }
    
    const turnInd = document.getElementById('ludo-turn-indicator'); turnInd.className = 'turn-indicator';
    if (isGameOver) { turnInd.innerText = "GAME OVER"; turnInd.style.background = "#222"; } 
    else { turnInd.innerText = isMyTurn ? "Your Turn!" : `${data.turnPlayer}'s Turn`; if (isMyTurn) turnInd.classList.add('my-turn-pulse'); else turnInd.style.background = "#444"; }

    document.getElementById('ludo-dice').innerText = data.lastRoll ? `🎲 ${data.lastRoll}` : '🎲';
    document.getElementById('ludo-roll-btn').onclick = () => { if(isMyTurn && !isGameOver) socket.emit('rollLudo', {roomId: myRoomId, username: myName}); };
    
    const list = document.getElementById('ludo-players-list'); list.innerHTML = '';
    data.playerList.forEach(p => { 
        list.innerHTML += `<div><b>${p.name}</b> (${p.color}): Base[${p.pieces.filter(x=>x===-1).length}] Path[${p.pieces.filter(x=>x>=0 && x<57).length}] Home[${p.pieces.filter(x=>x===57).length}]</div>`; 
    });
}
