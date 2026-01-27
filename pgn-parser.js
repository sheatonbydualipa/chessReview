// PGN Parser - Handles parsing of PGN files with variations support

class PGNParser {
    constructor() {
        this.games = [];
    }

    // Parse PGN text and extract games
    parse(pgnText) {
        this.games = [];
        const gameBlocks = pgnText.split(/\n\n(?=\[Event)/);
        
        gameBlocks.forEach(block => {
            if (!block.trim()) return;
            
            const variants = this.parseGameBlock(block);
            if (variants && variants.length > 0) {
                this.games.push(...variants);
            }
        });
        
        return this.games;
    }

    // Parse individual game block and extract all variations
    parseGameBlock(block) {
        const lines = block.split('\n');
        const headers = {};
        let movesText = '';
        
        // Parse headers and moves
        lines.forEach(line => {
            const headerMatch = line.match(/\[(\w+)\s+"([^"]+)"\]/);
            if (headerMatch) {
                headers[headerMatch[1]] = headerMatch[2];
            } else if (line.trim() && !line.startsWith('[')) {
                movesText += ' ' + line;
            }
        });
        
        // Remove comments in braces
        movesText = movesText.replace(/\{[^}]*\}/g, '');
        
        // Extract all variations
        const allVariations = this.extractAllVariations(movesText);
        
        if (allVariations.length === 0) return null;
        
        const baseName = this.getGameName(headers);
        
        // Create a game object for each variation
        return allVariations.map((variation, index) => {
            let variantName = baseName;
            
            // Add variation info to name if there are multiple variations
            if (allVariations.length > 1) {
                if (index === 0) {
                    variantName = `${baseName} - Ligne principale`;
                } else {
                    variantName = `${baseName} - ${variation.name}`;
                }
            }
            
            return {
                headers,
                moves: variation.moves,
                name: variantName,
                deviationPoint: variation.deviationPoint
            };
        });
    }

    // Extract all variations from moves text
    extractAllVariations(movesText) {
        const variations = [];
        
        // Parse the main line and all variations
        const parseResult = this.parseMovesWithVariations(movesText, [], null, '');
        
        // Main line
        if (parseResult.mainLine.length > 0) {
            variations.push({
                moves: parseResult.mainLine,
                name: 'Ligne principale',
                deviationPoint: null
            });
        }
        
        // All variations
        parseResult.variations.forEach(v => {
            variations.push(v);
        });
        
        return variations;
    }

    // Parse moves with variations (recursive)
    parseMovesWithVariations(movesText, parentMoves = [], deviationMoveNumber = null, parentPath = '') {
        const result = {
            mainLine: [],
            variations: []
        };
        
        let currentMoves = [...parentMoves];
        let buffer = '';
        let depth = 0;
        let variationStart = -1;
        let moveNumberBeforeVariation = null;
        let movesBeforeVariation = [];
        
        for (let i = 0; i < movesText.length; i++) {
            const char = movesText[i];
            
            if (char === '(') {
                if (depth === 0) {
                    // Process moves before variation
                    const movesBeforeVar = this.cleanAndParseMoves(buffer);
                    currentMoves.push(...movesBeforeVar);
                    
                    // Store moves up to this point for the variation
                    movesBeforeVariation = [...currentMoves];
                    
                    // Extract the move number before this variation
                    // Look for the last move number in the buffer
                    const allMoveNums = buffer.match(/(\d+)\./g);
                    if (allMoveNums && allMoveNums.length > 0) {
                        const lastMoveNum = allMoveNums[allMoveNums.length - 1];
                        moveNumberBeforeVariation = parseInt(lastMoveNum);
                    }
                    
                    buffer = '';
                    variationStart = i + 1;
                }
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    // Extract variation
                    const variationText = movesText.substring(variationStart, i);
                    
                    // Get the first move of this variation for naming
                    const firstMove = this.getFirstMoveFromText(variationText);
                    const varName = moveNumberBeforeVariation && firstMove 
                        ? `${moveNumberBeforeVariation}.${firstMove}`
                        : 'Variation';
                    
                    // Create full path for nested variations
                    const fullPath = parentPath ? `${parentPath} → ${varName}` : varName;
                    
                    // Parse the variation recursively - pass the moves before the variation as parent
                    const variationResult = this.parseMovesWithVariations(
                        variationText, 
                        movesBeforeVariation.slice(0, -1), // Remove the last move (the one we're deviating from)
                        moveNumberBeforeVariation,
                        fullPath
                    );
                    
                    // Add as a variation
                    if (variationResult.mainLine.length > 0) {
                        result.variations.push({
                            moves: variationResult.mainLine,
                            name: fullPath,
                            deviationPoint: moveNumberBeforeVariation
                        });
                    }
                    
                    // Also add nested variations
                    result.variations.push(...variationResult.variations);
                    
                    variationStart = -1;
                    moveNumberBeforeVariation = null;
                    movesBeforeVariation = [];
                }
            } else if (depth === 0) {
                buffer += char;
            }
        }
        
        // Process remaining moves
        if (buffer.trim()) {
            const remainingMoves = this.cleanAndParseMoves(buffer);
            currentMoves.push(...remainingMoves);
        }
        
        result.mainLine = currentMoves;
        return result;
    }

    // Get first move from variation text for naming
    getFirstMoveFromText(text) {
        // Remove move numbers and get first actual move
        const cleaned = text.trim();
        // Match the first move notation (after potential move number)
        const match = cleaned.match(/(?:\d+\.+\s*)?([KQRBNP]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)/);
        return match ? match[1] : null;
    }

    // Clean and parse moves (without variations)
    cleanAndParseMoves(movesText) {
        // Remove move numbers
        movesText = movesText.replace(/\d+\.\s*/g, '');
        
        // Remove extra whitespace
        movesText = movesText.replace(/\s+/g, ' ').trim();
        
        // Split into individual moves
        const moves = movesText
            .split(/\s+/)
            .filter(m => m && !m.match(/^[01\-\/]/) && m !== '*' && m !== '1/2-1/2');
        
        return moves;
    }

    // Generate game name from headers
    getGameName(headers) {
        if (headers.ChapterName) {
            return headers.ChapterName;
        }
        
        if (headers.Opening) {
            return headers.Opening;
        }
        
        if (headers.Event) {
            if (headers.White && headers.Black) {
                return `${headers.Event}: ${headers.White} vs ${headers.Black}`;
            }
            return headers.Event;
        }
        
        if (headers.White && headers.Black) {
            return `${headers.White} vs ${headers.Black}`;
        }
        
        return 'Partie sans nom';
    }

    // Get all games
    getGames() {
        return this.games;
    }

    // Get game by index
    getGame(index) {
        return this.games[index] || null;
    }

    // Get number of games
    getGameCount() {
        return this.games.length;
    }
}