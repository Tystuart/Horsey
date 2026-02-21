// Game Constants & Config
const HORSE_CONFIG = {
    2: { id: 2, steps: 3 },
    3: { id: 3, steps: 4 },
    4: { id: 4, steps: 5 },
    5: { id: 5, steps: 6 },
    6: { id: 6, steps: 7 },
    7: { id: 7, steps: 8 }, // The most common roll has the most steps
    8: { id: 8, steps: 7 },
    9: { id: 9, steps: 6 },
    10: { id: 10, steps: 5 },
    11: { id: 11, steps: 4 },
    12: { id: 12, steps: 3 }
};

const SCRATCH_PENALTIES = [5, 10, 15, 20]; // Costs for scratches 1, 2, 3, 4

// Game State
let gameState = {
    phase: 'INIT', // INIT, SCRATCHING, RACING, FINISHED
    pot: 0,
    scratchesFound: 0,
    horses: {}, // Will populated from config
    scratchedHorses: [],
    winner: null
};

// DOM Elements
const els = {
    potValue: document.getElementById('pot-value'),
    tracksContainer: document.getElementById('tracks-container'),
    actionButton: document.getElementById('action-button'),
    resetButton: document.getElementById('reset-button'),
    die1: document.getElementById('die-1'),
    die2: document.getElementById('die-2'),
    rollTotal: document.getElementById('roll-total'),
    phaseTitle: document.getElementById('phase-title'),
    phaseInstructions: document.getElementById('phase-instructions'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalClose: document.getElementById('modal-close')
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Initialization
function initGame() {
    // Reset state
    gameState = {
        phase: 'INIT',
        pot: 0,
        scratchesFound: 0,
        horses: JSON.parse(JSON.stringify(HORSE_CONFIG)), // Deep copy
        scratchedHorses: [],
        winner: null
    };

    // Reset UI
    els.potValue.innerText = '0';
    els.rollTotal.innerText = '-';
    els.die1.innerHTML = '<span class="die-face">⚀</span>';
    els.die2.innerHTML = '<span class="die-face">⚀</span>';

    // Reset scratches
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`scratch-${i}`);
        slot.classList.remove('filled');
        slot.querySelector('.horse-placeholder').innerHTML = '';
    }

    updatePhaseUI('Ready to Play', 'Click Start Game to begin the Scratch Phase.');
    els.actionButton.innerText = 'Start Game';

    renderTracks();
}

function renderTracks() {
    els.tracksContainer.innerHTML = '';

    // Sort keys 2-12
    const horseIds = Object.keys(HORSE_CONFIG).sort((a, b) => a - b);

    horseIds.forEach(id => {
        const config = HORSE_CONFIG[id];
        const lane = document.createElement('div');
        lane.className = `track-lane lane-${id}`;
        lane.id = `lane-${id}`;

        let segmentsHtml = '';
        for (let i = 0; i < config.steps; i++) {
            segmentsHtml += `<div class="track-segment"></div>`;
        }

        lane.innerHTML = `
            <div class="horse-label">${id}</div>
            <div class="track-segments">${segmentsHtml}</div>
            <div class="horse-token" id="token-${id}" data-id="${id}" style="left: 45px;"></div>
        `;

        // Initialize position state in JS
        gameState.horses[id].position = 0;

        els.tracksContainer.appendChild(lane);
    });
}

// Dice Logic
function rollDice() {
    return new Promise((resolve) => {
        // Animation
        els.die1.classList.add('rolling');
        els.die2.classList.add('rolling');
        els.actionButton.disabled = true;

        let rolls = 0;
        const rollInterval = setInterval(() => {
            const r1 = Math.floor(Math.random() * 6);
            const r2 = Math.floor(Math.random() * 6);
            els.die1.innerHTML = `<span class="die-face">${DICE_FACES[r1]}</span>`;
            els.die2.innerHTML = `<span class="die-face">${DICE_FACES[r2]}</span>`;
            rolls++;

            if (rolls > 15) { // Stop after 15 fast changes
                clearInterval(rollInterval);
                els.die1.classList.remove('rolling');
                els.die2.classList.remove('rolling');

                const finalR1 = Math.floor(Math.random() * 6) + 1;
                const finalR2 = Math.floor(Math.random() * 6) + 1;
                const total = finalR1 + finalR2;

                els.die1.innerHTML = `<span class="die-face">${DICE_FACES[finalR1 - 1]}</span>`;
                els.die2.innerHTML = `<span class="die-face">${DICE_FACES[finalR2 - 1]}</span>`;
                els.rollTotal.innerText = total;
                els.actionButton.disabled = false;

                resolve(total);
            }
        }, 50);
    });
}

// Game Flow
async function handleActionClick() {
    if (gameState.phase === 'INIT') {
        gameState.phase = 'SCRATCHING';
        updatePhaseUI('Scratching Phase', 'Roll to find 4 scratched horses.');
        els.actionButton.innerText = 'Roll for Scratch';
        return;
    }

    if (gameState.phase === 'SCRATCHING') {
        const roll = await rollDice();
        handleScratchRoll(roll);
        return;
    }

    if (gameState.phase === 'RACING') {
        const roll = await rollDice();
        handleRaceRoll(roll);
        return;
    }
}

function handleScratchRoll(roll) {
    if (gameState.scratchedHorses.includes(roll)) {
        // Already scratched, pay penalty anyway
        addToPot(SCRATCH_PENALTIES[gameState.scratchesFound]);
        // Don't count it as a new scratch found, just a penalty
        updatePhaseUI('Already Scratched!', `Horse ${roll} is out. Penalty paid.`);
        return;
    }

    // New Scratch
    gameState.scratchesFound++;
    gameState.scratchedHorses.push(roll);

    // UI Updates for Scratch
    const lane = document.getElementById(`lane-${roll}`);
    lane.classList.add('scratched');
    const token = document.getElementById(`token-${roll}`);
    token.classList.add('scratched');

    // Move to side panel
    const slotId = `scratch-${gameState.scratchesFound}`;
    const slot = document.getElementById(slotId);
    slot.classList.add('filled');
    slot.querySelector('.horse-placeholder').innerHTML = `<div class="horse-token" data-id="${roll}" style="position:relative; left:0; transform:none;"></div>`;

    addToPot(SCRATCH_PENALTIES[gameState.scratchesFound - 1]);

    if (gameState.scratchesFound === 4) {
        gameState.phase = 'RACING';
        updatePhaseUI('They\'re Off!', 'Roll to move horses. Scratched rolls pay the pot.');
        els.actionButton.innerText = 'Roll to Race';
    } else {
        updatePhaseUI('Scratched!', `Horse ${roll} scratched. ${4 - gameState.scratchesFound} to go.`);
    }
}

function handleRaceRoll(roll) {
    if (gameState.scratchedHorses.includes(roll)) {
        // Penalty payment
        const scratchIndex = gameState.scratchedHorses.indexOf(roll);
        const penalty = SCRATCH_PENALTIES[scratchIndex];
        addToPot(penalty);
        updatePhaseUI('Penalty!', `Rolled a scratched horse (${roll}). Total Pot: ${gameState.pot}`);
        return;
    }

    // Move Horse
    const horse = gameState.horses[roll];
    horse.position++;

    // Update UI Position
    const token = document.getElementById(`token-${roll}`);
    const segmentWidth = 60; // Approximating width
    const newLeft = 45 + (horse.position * segmentWidth);
    token.style.left = `${newLeft}px`;

    if (horse.position >= horse.steps) {
        // Winner!
        gameState.phase = 'FINISHED';
        gameState.winner = roll;
        updatePhaseUI(`Winner! Horse ${roll}`, `Took home the pot of ${gameState.pot} chips!`);
        els.actionButton.disabled = true;
        showModal(`🏆 Horse ${roll} Wins!`, `The payout is ${gameState.pot} chips.`);
    } else {
        updatePhaseUI('Racing...', `Horse ${roll} advances!`);
    }
}

function addToPot(amount) {
    gameState.pot += amount;
    // Animate pot number
    els.potValue.style.transform = 'scale(1.5)';
    els.potValue.style.color = '#fff';
    setTimeout(() => {
        els.potValue.innerText = gameState.pot;
        els.potValue.style.transform = 'scale(1)';
        els.potValue.style.color = 'inherit';
    }, 200);
}

function updatePhaseUI(title, instr) {
    els.phaseTitle.innerText = title;
    els.phaseInstructions.innerText = instr;
}

function showModal(title, content) {
    els.modalTitle.innerText = title;
    els.modalContent.innerText = content;
    els.modalOverlay.classList.remove('hidden');
}

// Event Listeners
els.actionButton.addEventListener('click', handleActionClick);
els.resetButton.addEventListener('click', initGame);
els.modalClose.addEventListener('click', () => {
    els.modalOverlay.classList.add('hidden');
});

// Boot
initGame();
