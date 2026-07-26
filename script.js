// WARNING: Replace this IP with your Oracle Cloud Public IP later
const backendUrl = "http://150.136.140.179:3000"; 
const socket = io(backendUrl);

const boardElement = document.getElementById('board');
const teamColorSelect = document.getElementById('teamColor');

// Create the 100 HTML grid squares
for (let i = 0; i < 100; i++) {
    const space = document.createElement('div');
    space.classList.add('space');
    space.dataset.index = i;
    
    // When a space is clicked, send the move to the server
    space.addEventListener('click', () => {
        const color = teamColorSelect.value;
        socket.emit('playMove', { index: i, color: color });
    });
    
    boardElement.appendChild(space);
}

// When the server announces a board update, redraw the chips
socket.on('boardUpdate', (boardState) => {
    const spaces = document.querySelectorAll('.space');
    
    boardState.forEach((color, index) => {
        spaces[index].innerHTML = ''; // Clear the space
        
        if (color) {
            const chip = document.createElement('div');
            chip.classList.add('chip', color);
            spaces[index].appendChild(chip);
        }
    });
});
