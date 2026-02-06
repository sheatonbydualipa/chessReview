// Main Application Logic

// Application state
let chessEngine = new ChessEngine();
let pgnParser = new PGNParser();
let selectedColor = null;
let selectedVariant = null;
let isRandomMode = false;
let currentMoveIndex = 0;
let selectedSquare = null;
let isTraining = false;
let moveSequence = [];

// DOM Elements
const pgnFileInput = document.getElementById('pgnFile');
const fileNameDiv = document.getElementById('fileName');
const pgnTextarea = document.getElementById('pgnTextarea');
const loadPgnButton = document.getElementById('loadPgnButton');
const colorButtons = document.querySelectorAll('.color-button');
const variantList = document.getElementById('variantList');
const randomButton = document.getElementById('randomButton');
const startButton = document.getElementById('startButton');
const chessboard = document.getElementById('chessboard');
const statusBar = document.getElementById('statusBar');
const statusMessage = document.getElementById('statusMessage');
const moveInfo = document.getElementById('moveInfo');
const controls = document.getElementById('controls');
const resetButton = document.getElementById('resetButton');
const hintButton = document.getElementById('hintButton');

// Initialize application
function init() {
    initializeBoard();
    setupEventListeners();
}

// Initialize chessboard
function initializeBoard() {
    chessboard.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', handleSquareClick);
            chessboard.appendChild(square);
        }
    }
    renderBoard();
}

// Render current board position
function renderBoard() {
    const board = chessEngine.getBoard();
    const squares = chessboard.querySelectorAll('.square');
    
    squares.forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const piece = board[row][col];
        
        // Clear previous content
        square.innerHTML = '';
        square.classList.remove('selected', 'valid-move', 'capture-move');
        
        // Add piece image if present
        if (piece && pieces[piece]) {
            const img = document.createElement('img');
            img.src = pieces[piece];
            img.className = 'piece-image';
            img.alt = piece;
            img.draggable = false;
            square.appendChild(img);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    pgnFileInput.addEventListener('change', handleFileUpload);
    loadPgnButton.addEventListener('click', handlePgnPaste);
    
    colorButtons.forEach(button => {
        button.addEventListener('click', () => handleColorSelection(button));
    });
    
    randomButton.addEventListener('click', handleRandomMode);
    startButton.addEventListener('click', startTraining);
    resetButton.addEventListener('click', resetTraining);
    hintButton.addEventListener('click', showHint);
}

// Handle PGN file upload
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    fileNameDiv.textContent = file.name;
    pgnTextarea.value = ''; // Clear textarea when file is uploaded
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const games = pgnParser.parse(event.target.result);
            displayVariants(games);
            checkCanStart();
        } catch (error) {
            alert('Erreur lors de la lecture du fichier PGN');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// Handle PGN paste from textarea
function handlePgnPaste() {
    const pgnText = pgnTextarea.value.trim();
    
    if (!pgnText) {
        alert('Veuillez coller du contenu PGN dans la zone de texte');
        return;
    }
    
    try {
        const games = pgnParser.parse(pgnText);
        
        if (games.length === 0) {
            alert('Aucune partie valide trouvée dans le PGN');
            return;
        }
        
        fileNameDiv.textContent = `${games.length} partie${games.length > 1 ? 's' : ''} chargée${games.length > 1 ? 's' : ''} depuis le texte`;
        pgnFileInput.value = ''; // Clear file input when using paste
        
        displayVariants(games);
        checkCanStart();
    } catch (error) {
        alert('Erreur lors de l\'analyse du PGN');
        console.error(error);
    }
}

// Display variants
function displayVariants(games) {
    if (games.length === 0) {
        variantList.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 2rem;">Aucune variante trouvée</div>';
        return;
    }
    
    variantList.innerHTML = '';
    games.forEach((game, index) => {
        const item = document.createElement('div');
        item.className = 'variant-item';
        item.textContent = `${index + 1}. ${game.name}`;
        item.addEventListener('click', () => selectVariant(index));
        variantList.appendChild(item);
    });
}

// Select variant
function selectVariant(index) {
    selectedVariant = index;
    isRandomMode = false;
    document.querySelectorAll('.variant-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
    randomButton.classList.remove('active');
    checkCanStart();
}

// Handle color selection
function handleColorSelection(button) {
    selectedColor = button.dataset.color;
    colorButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    checkCanStart();
}

// Handle random mode
function handleRandomMode() {
    if (pgnParser.getGameCount() === 0) {
        alert('Veuillez d\'abord charger un fichier PGN');
        return;
    }
    
    isRandomMode = true;
    selectedVariant = null;
    
    // Désactiver toutes les variantes sélectionnées
    document.querySelectorAll('.variant-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Activer le bouton aléatoire
    randomButton.classList.add('active');
    
    checkCanStart();
}

// Select random variant
function selectRandomVariant() {
    const totalVariants = pgnParser.getGameCount();
    return Math.floor(Math.random() * totalVariants);
}

// Check if can start training
function checkCanStart() {
    const canStart = pgnParser.getGameCount() > 0 && selectedColor && (selectedVariant !== null || isRandomMode);
    startButton.disabled = !canStart;
}

// Start training
function startTraining() {
    isTraining = true;
    currentMoveIndex = 0;
    chessEngine.resetBoard();
    
    // Si mode aléatoire, sélectionner une variante aléatoire
    let variantIndex;
    if (isRandomMode) {
        variantIndex = selectRandomVariant();
    } else {
        variantIndex = selectedVariant;
    }
    
    const game = pgnParser.getGame(variantIndex);
    moveSequence = game.moves;
    
    statusBar.classList.remove('hidden');
    controls.classList.remove('hidden');
    
    // Afficher le nom de la variante
    if (isRandomMode) {
        statusMessage.textContent = `Mode aléatoire: ${game.name}`;
        statusMessage.style.color = 'var(--accent-gold)';
        setTimeout(() => updateStatus(), 2000);
    }
    
    // Flip board if playing as black
    updateBoardOrientation();
    
    renderBoard();
    
    // If playing black, make white's first move
    if (selectedColor === 'black') {
        setTimeout(() => makeComputerMove(), isRandomMode ? 2000 : 0);
    } else {
        if (!isRandomMode) {
            updateStatus();
        }
    }
}

// Update board orientation based on selected color
function updateBoardOrientation() {
    if (selectedColor === 'black') {
        chessboard.classList.add('flipped');
    } else {
        chessboard.classList.remove('flipped');
    }
}

// Reset training
function resetTraining() {
    currentMoveIndex = 0;
    chessEngine.resetBoard();
    selectedSquare = null;
    
    // Si mode aléatoire, choisir une nouvelle variante aléatoire
    if (isRandomMode) {
        const variantIndex = selectRandomVariant();
        const game = pgnParser.getGame(variantIndex);
        moveSequence = game.moves;
        
        // Afficher le nom de la nouvelle variante
        statusMessage.textContent = `Nouvelle variante: ${game.name}`;
        statusMessage.style.color = 'var(--accent-gold)';
        setTimeout(() => updateStatus(), 2000);
    }
    
    renderBoard();
    
    if (selectedColor === 'black') {
        setTimeout(() => makeComputerMove(), isRandomMode ? 2000 : 0);
    } else {
        if (!isRandomMode) {
            updateStatus();
        }
    }
}

// Update status message
function updateStatus() {
    if (currentMoveIndex >= moveSequence.length) {
        statusMessage.textContent = 'Variante terminée ! Bravo !';
        statusMessage.style.color = 'var(--accent-gold)';
        
        // En mode aléatoire, proposer de continuer
        if (isRandomMode) {
            moveInfo.textContent = 'Cliquez sur "Recommencer" pour une nouvelle variante aléatoire';
        } else {
            moveInfo.textContent = '';
        }
        return;
    }
    
    const isPlayerTurn = (selectedColor === 'white' && currentMoveIndex % 2 === 0) ||
                        (selectedColor === 'black' && currentMoveIndex % 2 === 1);
    
    if (isPlayerTurn) {
        statusMessage.textContent = 'À vous de jouer !';
        statusMessage.style.color = '';
        moveInfo.textContent = `Coup ${Math.floor(currentMoveIndex / 2) + 1}`;
    } else {
        statusMessage.textContent = 'L\'ordinateur joue...';
        statusMessage.style.color = 'var(--accent-gold)';
    }
}

// Make computer move
function makeComputerMove() {
    if (currentMoveIndex >= moveSequence.length) {
        updateStatus();
        return;
    }
    
    setTimeout(() => {
        const move = moveSequence[currentMoveIndex];
        const isWhiteMove = currentMoveIndex % 2 === 0;
        
        chessEngine.applyMove(move, isWhiteMove);
        currentMoveIndex++;
        renderBoard();
        
        // Check if player's turn
        const isPlayerTurn = (selectedColor === 'white' && currentMoveIndex % 2 === 0) ||
                            (selectedColor === 'black' && currentMoveIndex % 2 === 1);
        
        if (isPlayerTurn || currentMoveIndex >= moveSequence.length) {
            updateStatus();
        } else {
            makeComputerMove();
        }
    }, 500);
}

// Handle square click
function handleSquareClick(e) {
    if (!isTraining) return;
    
    const square = e.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    
    const isPlayerTurn = (selectedColor === 'white' && currentMoveIndex % 2 === 0) ||
                        (selectedColor === 'black' && currentMoveIndex % 2 === 1);
    
    if (!isPlayerTurn) return;
    
    const piece = chessEngine.getPieceAt(row, col);
    const isWhitePiece = piece && piece === piece.toUpperCase();
    const isBlackPiece = piece && piece === piece.toLowerCase();
    
    // Check if clicking own piece
    if ((selectedColor === 'white' && isWhitePiece) || (selectedColor === 'black' && isBlackPiece)) {
        // Select piece
        selectedSquare = { row, col };
        renderBoard();
        square.classList.add('selected');
        showValidMoves(row, col);
    } else if (selectedSquare) {
        // Check if this is a castling move
        const fromPiece = chessEngine.getPieceAt(selectedSquare.row, selectedSquare.col);
        
        // Detect castling: King moving 2 squares horizontally
        if (fromPiece && fromPiece.toUpperCase() === 'K') {
            const colDiff = col - selectedSquare.col;
            
            if (Math.abs(colDiff) === 2) {
                // This is a castling move
                const isKingside = colDiff > 0;
                const expectedMove = moveSequence[currentMoveIndex];
                const castlingNotation = isKingside ? 'O-O' : 'O-O-O';
                
                if (chessEngine.movesMatch(castlingNotation, expectedMove)) {
                    // Correct castling move
                    const isWhiteMove = currentMoveIndex % 2 === 0;
                    chessEngine.applyMove(castlingNotation, isWhiteMove);
                    selectedSquare = null;
                    currentMoveIndex++;
                    
                    square.classList.add('correct');
                    setTimeout(() => {
                        renderBoard();
                        
                        // Check if we've reached the end after this move
                        if (currentMoveIndex >= moveSequence.length) {
                            updateStatus();
                        } else {
                            // Check if it's the computer's turn next
                            const isPlayerTurnNext = (selectedColor === 'white' && currentMoveIndex % 2 === 0) ||
                                                    (selectedColor === 'black' && currentMoveIndex % 2 === 1);
                            
                            if (isPlayerTurnNext) {
                                updateStatus();
                            } else {
                                makeComputerMove();
                            }
                        }
                    }, 600);
                } else {
                    // Incorrect castling
                    square.classList.add('incorrect');
                    setTimeout(() => {
                        square.classList.remove('incorrect');
                    }, 600);
                    
                    statusMessage.textContent = 'Mauvais coup ! Réessayez.';
                    statusMessage.style.color = '#cc3333';
                    
                    setTimeout(() => {
                        updateStatus();
                    }, 2000);
                }
                return;
            }
        }
        
        // Try to make regular move
        attemptMove(selectedSquare.row, selectedSquare.col, row, col, square);
    }
}

// Show valid moves for selected piece
function showValidMoves(row, col) {
    const validMoves = chessEngine.getValidMoves(row, col);
    const board = chessEngine.getBoard();
    const piece = board[row][col];
    
    const squares = chessboard.querySelectorAll('.square');
    validMoves.forEach(move => {
        const targetSquare = squares[move.row * 8 + move.col];
        if (board[move.row][move.col]) {
            targetSquare.classList.add('capture-move');
        } else {
            targetSquare.classList.add('valid-move');
        }
    });
    
    // For kings, also show castling squares if castling is the next expected move
    if (piece && piece.toUpperCase() === 'K') {
        const expectedMove = moveSequence[currentMoveIndex];
        
        if (expectedMove === 'O-O' || expectedMove === '0-0') {
            // Kingside castling - highlight g-file
            const kingsideCol = 6;
            const kingsideSquare = squares[row * 8 + kingsideCol];
            kingsideSquare.classList.add('valid-move');
        } else if (expectedMove === 'O-O-O' || expectedMove === '0-0-0') {
            // Queenside castling - highlight c-file
            const queensideCol = 2;
            const queensideSquare = squares[row * 8 + queensideCol];
            queensideSquare.classList.add('valid-move');
        }
    }
}

// Attempt to make move
function attemptMove(fromRow, fromCol, toRow, toCol, square) {
    const piece = chessEngine.getPieceAt(fromRow, fromCol);
    const expectedMove = moveSequence[currentMoveIndex];
    
    // Extract promotion piece from expected move if present
    let promotionPiece = null;
    const promoMatch = expectedMove.match(/=([QRBN])/);
    if (promoMatch) {
        promotionPiece = promoMatch[1];
    }
    
    const moveNotation = chessEngine.constructMoveNotation(fromRow, fromCol, toRow, toCol, promotionPiece);
    
    if (chessEngine.movesMatch(moveNotation, expectedMove)) {
        // Correct move
        chessEngine.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
        selectedSquare = null;
        currentMoveIndex++;
        
        square.classList.add('correct');
        setTimeout(() => {
            renderBoard();
            
            // Check if we've reached the end after this move
            if (currentMoveIndex >= moveSequence.length) {
                updateStatus();
            } else {
                // Check if it's the computer's turn next
                const isPlayerTurnNext = (selectedColor === 'white' && currentMoveIndex % 2 === 0) ||
                                        (selectedColor === 'black' && currentMoveIndex % 2 === 1);
                
                if (isPlayerTurnNext) {
                    updateStatus();
                } else {
                    makeComputerMove();
                }
            }
        }, 600);
    } else {
        // Incorrect move
        square.classList.add('incorrect');
        setTimeout(() => {
            square.classList.remove('incorrect');
        }, 600);
        
        statusMessage.textContent = 'Mauvais coup ! Réessayez.';
        statusMessage.style.color = '#cc3333';
        
        setTimeout(() => {
            updateStatus();
        }, 2000);
    }
}

// Show hint
function showHint() {
    if (currentMoveIndex >= moveSequence.length) return;
    
    const nextMove = moveSequence[currentMoveIndex];
    statusMessage.textContent = `Indice : ${nextMove}`;
    statusMessage.style.color = 'var(--accent-gold)';
    
    setTimeout(() => {
        updateStatus();
    }, 3000);
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);