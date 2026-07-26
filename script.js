// REPLACE WITH YOUR SECURE CLOUDFLARE/ORACLE URL
const backendUrl = "https://gasoline-meetings-task-languages.trycloudflare.com"; 
const socket = io(backendUrl);

// --- DOM Elements ---
const nameScreen = document.getElementById('name-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

const nicknameInput = document.getElementById('nickname');
const submitNameBtn = document.getElementById('submit-name');

const shareLinkInput = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-btn');
const startGameBtn = document.getElementById('start-game-btn');

const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const turnIndicator = document.getElementById('turn-indicator');
const lastDiscardedEl = document.getElementById('last-discarded');
const cardsLeftEl = document.getElementById('cards-left');

// --- State Variables ---
let myName = "";
let myRoomId = "";
let isHost = false;
let selectedCard = null;

// --- 1. URL & Room Logic ---
// Check if they clicked a invite link (e.g., ?room=xyz)
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');

if (roomFromUrl) {
    myRoomId = roomFromUrl;
} else {
    // They are the creator/host. Generate a random 7-character room ID
    myRoomId = Math.random().toString(36).substring(2, 9);
}

// --- 2. Screen 1: Name Entry ---
submitNameBtn.addEventListener('click', () => {
    myName = nicknameInput.value.trim();
    if (!myName) return alert("Please enter a nickname!");

    // Switch Screens
    nameScreen.classList.remove('active');
    lobbyScreen.classList.add('active');

    // Populate the share link box
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${myRoomId}`;
    shareLinkInput.value = inviteUrl;

    // Join the Server Room
    socket.emit('joinRoom', { roomId: myRoomId, nickname: myName });
});

// Copy link button
copyBtn.addEventListener('click', () => {
    shareLinkInput.select();
    document.execCommand('copy');
    copyBtn.innerText = "Copied!";
    setTimeout(() => copyBtn.innerText = "Copy", 2000);
});

// --- 3. Screen 2: Lobby & Drag-and-Drop ---
const dropzones = {
    'blue': document.getElementById('blue-dropzone'),
    'red': document.getElementById('red-dropzone'),
    'green': document.getElementById('green-dropzone')
};

// Setup Drag and Drop listeners for the team boxes
Object.keys(dropzones).forEach(teamColor => {
    const zone = dropzones[teamColor];
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault(); // Required to allow dropping
        zone.style.filter = "brightness(1.2)";
    });

    zone.addEventListener('dragleave', () => {
        zone.style.filter = "none";
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.filter = "none";
        
        // Only allow the host to reorganize teams (optional rule, but good for UX)
        if (!isHost) return alert("Only the host can assign teams.");

        const playerName = e.dataTransfer.getData('text/plain');
        
        // Tell the server this player moved to a new team
        socket.emit('updateTeams', {
            roomId: myRoomId,
            updatedPlayers: [{ name: playerName, team: teamColor }]
        });
    });
});

socket.on('lobbyUpdate', (players) => {
    // Clear all dropzones first
    Object.values(dropzones).forEach(zone => { if(zone) zone.innerHTML = ''; });

    players.forEach(p => {
        // Determine if I am the host
        if (p.name === myName && p.isHost) {
            isHost = true;
            startGameBtn.style.display = "block"; // Show start button
        } else if (p.name === myName && !p.isHost) {
            startGameBtn.style.display = "none"; // Hide start button for guests
        }

        // Create the draggable player tag
        const playerTag = document.createElement('div');
        playerTag.innerText = p.name;
        playerTag.style.background = "rgba(255,255,255,0.3)";
        playerTag.style.padding = "5px 10px";
        playerTag.style.margin = "5px";
        playerTag.style.borderRadius = "4px";
        playerTag.style.cursor = isHost ? "grab" : "default";
        playerTag.style.fontWeight = "bold";

        // Make it draggable
        if (isHost) {
            playerTag.draggable = true;
            playerTag.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', p.name);
            });
        }

        // Put them in their assigned team box, or default to blue if unassigned
        const targetZone = dropzones[p.team] || dropzones['blue'];
        if (targetZone) targetZone.appendChild(playerTag);
    });
});

// Start the game
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomId: myRoomId });
});

// --- 4. Screen 3: Game Board & Play ---
socket.on('gameState', (data) => {
    // Hide Lobby, Show Game
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');

    // Update Top Banner
    turnIndicator.innerText = `${data.turn.toUpperCase()}'s Turn`;
    
    // Update Discard Pile Info
    if (data.cardsLeft !== undefined) cardsLeftEl.innerText = data.cardsLeft;
    if (data.lastDiscard) {
        lastDiscardedEl.innerText = data.lastDiscard;
        lastDiscardedEl.className = getSuitColorClass(data.lastDiscard);
    }

    renderBoard(data.board);
    renderHand(data.hand);
    
    // Reset selection every turn update
    selectedCard = null; 
});

socket.on('gameOver', (winnerTeam) => {
    alert(`GAME OVER! ${winnerTeam.toUpperCase()} TEAM WINS!`);
});

// Helper for card colors
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
            div.style.background = '#ff477e';
            div.style.color = 'white';
            div.innerText = 'FREE';
        } else {
            div.classList.add(getSuitColorClass(space.card));
            div.innerText = space.card;
        }

        // Render chips
        if (space.team) {
            const chip = document.createElement('div');
            // Re-using the team color variables
            const teamColors = { 'red': '#ff7675', 'blue': '#3b82f6', 'green': '#b8e994' };
            chip.style.backgroundColor = teamColors[space.team];
            chip.style.width = "40px";
            chip.style.height = "40px";
            chip.style.borderRadius = "50%";
            chip.style.position = "absolute";
            chip.style.border = "3px dashed white";
            div.appendChild(chip);
        }

        // Handle clicking to play a move
        div.addEventListener('click', () => {
            if (!selectedCard) return alert("Select a card from your hand first!");
            socket.emit('playMove', {
                roomId: myRoomId,
                username: myName,
                boardIndex: index,
                cardPlayed: selectedCard
            });
        });

        div.style.position = "relative"; // Needed to absolute-position the chip
        boardEl.appendChild(div);
    });
}

function renderHand(handArray) {
    handEl.innerHTML = '';
    handArray.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `hand-card ${getSuitColorClass(card)}`;
        cardDiv.innerText = card;
        
        // Basic styling for the hand cards
        cardDiv.style.background = "white";
        cardDiv.style.padding = "15px 10px";
        cardDiv.style.margin = "0 5px";
        cardDiv.style.borderRadius = "6px";
        cardDiv.style.cursor = "pointer";
        cardDiv.style.display = "inline-block";
        cardDiv.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
        cardDiv.style.fontWeight = "bold";
        
        cardDiv.addEventListener('click', () => {
            // Remove selection outline from all other cards
            Array.from(handEl.children).forEach(c => c.style.border = "none");
            
            // Highlight selected
            cardDiv.style.border = "4px solid #0de0d8";
            selectedCard = card;
        });
        
        handEl.appendChild(cardDiv);
    });
}
