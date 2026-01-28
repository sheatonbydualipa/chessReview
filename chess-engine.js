// Chess Engine - Handles board state and move logic

// Chess pieces images mapping
const pieces = {
    'K': 'piecesSet/wK.svg',
    'Q': 'piecesSet/wQ.svg',
    'R': 'piecesSet/wR.svg',
    'B': 'piecesSet/wB.svg',
    'N': 'piecesSet/wN.svg',
    'P': 'piecesSet/wP.svg',
    'k': 'piecesSet/bK.svg',
    'q': 'piecesSet/bQ.svg',
    'r': 'piecesSet/bR.svg',
    'b': 'piecesSet/bB.svg',
    'n': 'piecesSet/bN.svg',
    'p': 'piecesSet/bP.svg'
};

// Initial board position
const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

class ChessEngine {
    constructor() {
        this.board = JSON.parse(JSON.stringify(initialBoard));
    }

    resetBoard() {
        this.board = JSON.parse(JSON.stringify(initialBoard));
    }

    getBoard() {
        return this.board;
    }

    getPieceAt(row, col) {
        return this.board[row][col];
    }

    setPieceAt(row, col, piece) {
        this.board[row][col] = piece;
    }

    // Apply move to board from algebraic notation
    applyMove(moveNotation, isWhiteMove) {
        // Remove check/checkmate symbols
        moveNotation = moveNotation.replace(/[+#!?]/g, '');
        
        // Handle castling
        if (moveNotation === 'O-O' || moveNotation === '0-0') {
            this.handleCastling(true, isWhiteMove);
            return true;
        }
        if (moveNotation === 'O-O-O' || moveNotation === '0-0-0') {
            this.handleCastling(false, isWhiteMove);
            return true;
        }
        
        // Determine piece type and color
        let piece = isWhiteMove ? 'P' : 'p';
        let moveStr = moveNotation;
        
        if (/^[KQRBN]/.test(moveNotation)) {
            piece = isWhiteMove ? moveNotation[0] : moveNotation[0].toLowerCase();
            moveStr = moveNotation.slice(1);
        }
        
        // Extract destination square
        const destMatch = moveStr.match(/([a-h][1-8])/);
        if (!destMatch) return false;
        
        const destSquare = destMatch[1];
        const destCol = destSquare.charCodeAt(0) - 97;
        const destRow = 8 - parseInt(destSquare[1]);
        
        // Extract source file/rank hints if present
        let sourceFile = null;
        let sourceRank = null;
        let isCapture = moveStr.includes('x');
        
        // For pawns, the first character might be the source file if it's a capture
        if (piece.toUpperCase() === 'P' && /^[a-h]x/.test(moveStr)) {
            sourceFile = moveStr[0];
        } else {
            // For other pieces or pawn non-captures, check for disambiguation
            const sourceHint = moveStr.match(/^([a-h])?([1-8])?[x]?[a-h][1-8]/);
            if (sourceHint) {
                sourceFile = sourceHint[1];
                sourceRank = sourceHint[2];
            }
        }
        
        // Find piece to move
        let foundPiece = false;
        for (let row = 0; row < 8 && !foundPiece; row++) {
            for (let col = 0; col < 8 && !foundPiece; col++) {
                if (this.board[row][col] === piece) {
                    // Check source hints
                    if (sourceFile && String.fromCharCode(97 + col) !== sourceFile) continue;
                    if (sourceRank && (8 - row) !== parseInt(sourceRank)) continue;
                    
                    // Check if piece can reach destination
                    if (this.canPieceReach(piece, row, col, destRow, destCol, isCapture)) {
                        this.board[destRow][destCol] = piece;
                        this.board[row][col] = '';
                        foundPiece = true;
                    }
                }
            }
        }
        
        if (!foundPiece) return false;
        
        // Handle pawn promotion
        if (moveStr.includes('=')) {
            const promoMatch = moveStr.match(/=([QRBN])/);
            if (promoMatch) {
                const promoPiece = isWhiteMove ? promoMatch[1] : promoMatch[1].toLowerCase();
                this.board[destRow][destCol] = promoPiece;
            }
        }
        
        return true;
    }

    // Check if piece can reach destination (improved)
    canPieceReach(piece, fromRow, fromCol, toRow, toCol, isCapture = false) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        const isWhite = piece === piece.toUpperCase();
        
        switch (piece.toUpperCase()) {
            case 'P':
                // Pawn logic
                if (isWhite) {
                    // White pawns move up (decreasing row number)
                    const rowMove = fromRow - toRow;
                    
                    // Forward move (non-capture)
                    if (!isCapture && fromCol === toCol) {
                        // Single square forward
                        if (rowMove === 1) return true;
                        // Two squares forward from starting position
                        if (rowMove === 2 && fromRow === 6) return true;
                    }
                    
                    // Diagonal capture
                    if (isCapture && colDiff === 1 && rowMove === 1) {
                        return true;
                    }
                } else {
                    // Black pawns move down (increasing row number)
                    const rowMove = toRow - fromRow;
                    
                    // Forward move (non-capture)
                    if (!isCapture && fromCol === toCol) {
                        // Single square forward
                        if (rowMove === 1) return true;
                        // Two squares forward from starting position
                        if (rowMove === 2 && fromRow === 1) return true;
                    }
                    
                    // Diagonal capture
                    if (isCapture && colDiff === 1 && rowMove === 1) {
                        return true;
                    }
                }
                return false;
                
            case 'N':
                return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            case 'B':
                return rowDiff === colDiff && rowDiff > 0;
            case 'R':
                return (rowDiff === 0 && colDiff > 0) || (colDiff === 0 && rowDiff > 0);
            case 'Q':
                return (rowDiff === colDiff || rowDiff === 0 || colDiff === 0) && 
                       (rowDiff > 0 || colDiff > 0);
            case 'K':
                return rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0);
            default:
                return false;
        }
    }

    // Handle castling
    handleCastling(kingside, isWhite) {
        const row = isWhite ? 7 : 0;
        
        if (kingside) {
            // Kingside castling
            this.board[row][6] = isWhite ? 'K' : 'k';
            this.board[row][5] = isWhite ? 'R' : 'r';
            this.board[row][4] = '';
            this.board[row][7] = '';
        } else {
            // Queenside castling
            this.board[row][2] = isWhite ? 'K' : 'k';
            this.board[row][3] = isWhite ? 'R' : 'r';
            this.board[row][4] = '';
            this.board[row][0] = '';
        }
    }

    // Get valid moves for piece at position (improved)
    getValidMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        
        const validMoves = [];
        
        for (let targetRow = 0; targetRow < 8; targetRow++) {
            for (let targetCol = 0; targetCol < 8; targetCol++) {
                const targetPiece = this.board[targetRow][targetCol];
                const isCapture = targetPiece !== '';
                
                if (this.canPieceReach(piece, row, col, targetRow, targetCol, isCapture)) {
                    validMoves.push({ row: targetRow, col: targetCol });
                }
            }
        }
        
        return validMoves;
    }

    // Make move from coordinates
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;
        
        // Check for en passant capture
        if (piece.toUpperCase() === 'P' && fromCol !== toCol && this.board[toRow][toCol] === '') {
            // This is an en passant capture
            // Remove the captured pawn which is on the same row as the moving pawn
            this.board[fromRow][toCol] = '';
        }
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = '';
        return true;
    }

    // Construct move notation from coordinates
    constructMoveNotation(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];
        const destSquare = String.fromCharCode(97 + toCol) + (8 - toRow);
        
        let notation = '';
        
        // For pawn captures, include the source file
        if (piece.toUpperCase() === 'P') {
            if (targetPiece || fromCol !== toCol) {
                // It's a capture or en passant
                notation = String.fromCharCode(97 + fromCol);
            }
        } else {
            // For other pieces, add the piece letter
            notation = piece.toUpperCase();
        }
        
        // Add capture symbol if capturing
        if (targetPiece) {
            notation += 'x';
        }
        
        notation += destSquare;
        return notation;
    }

    // Check if two moves match (improved comparison)
    movesMatch(move1, move2) {
        // Remove check/checkmate symbols and annotations for comparison
        move1 = move1.replace(/[+#!?]/g, '');
        move2 = move2.replace(/[+#!?]/g, '');
        
        // Normalize castling notation
        move1 = move1.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
        move2 = move2.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
        
        // Check for exact match first
        if (move1 === move2) return true;
        
        // Extract destination squares
        const dest1 = move1.match(/([a-h][1-8])/);
        const dest2 = move2.match(/([a-h][1-8])/);
        
        if (!dest1 || !dest2) return false;
        
        // Check if destination squares match
        if (dest1[1] !== dest2[1]) return false;
        
        // Extract piece types (if any)
        const piece1 = move1.match(/^([KQRBN])/);
        const piece2 = move2.match(/^([KQRBN])/);
        
        // If both have piece indicators, they should match
        if (piece1 && piece2) {
            return piece1[1] === piece2[1];
        }
        
        // Check for pawn moves/captures
        const isPawn1 = !piece1;
        const isPawn2 = !piece2;
        
        if (isPawn1 && isPawn2) {
            // Both are pawn moves
            // Check if both are captures or both are non-captures
            const isCapture1 = move1.includes('x');
            const isCapture2 = move2.includes('x');
            
            if (isCapture1 && isCapture2) {
                // For pawn captures, also check the source file
                const sourceFile1 = move1.match(/^([a-h])/);
                const sourceFile2 = move2.match(/^([a-h])/);
                
                if (sourceFile1 && sourceFile2) {
                    return sourceFile1[1] === sourceFile2[1];
                }
            }
            
            return true;
        }
        
        // One is a pawn, one is not - no match
        return false;
    }
}