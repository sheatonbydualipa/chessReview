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
        
        // Extract all variations (comments are preserved for parsing)
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
                comments: variation.comments || {},
                name: variantName,
                deviationPoint: variation.deviationPoint
            };
        });
    }

    // Extract all variations from moves text
    extractAllVariations(movesText) {
        const variations = [];

        // Parse the main line and all variations
        const parseResult = this.parseMovesWithVariations(movesText, [], {}, null, '');

        // Main line
        if (parseResult.mainLine.length > 0) {
            variations.push({
                moves: parseResult.mainLine,
                comments: parseResult.mainLineComments,
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
    parseMovesWithVariations(movesText, parentMoves = [], parentComments = {}, deviationMoveNumber = null, parentPath = '') {
        const result = {
            mainLine: [],
            mainLineComments: {},
            variations: []
        };

        let currentMoves = [...parentMoves];
        let currentComments = {...parentComments};
        let buffer = '';
        let depth = 0;
        let inComment = false;
        let variationStart = -1;
        let moveNumberBeforeVariation = null;
        let movesBeforeVariation = [];
        let commentsBeforeVariation = {};

        for (let i = 0; i < movesText.length; i++) {
            const char = movesText[i];

            if (char === '{' && !inComment) {
                inComment = true;
                if (depth === 0) buffer += char;
            } else if (char === '}' && inComment) {
                inComment = false;
                if (depth === 0) buffer += char;
            } else if (!inComment && char === '(') {
                if (depth === 0) {
                    // Process moves before variation (preserving comments in buffer)
                    const {moves: movesBeforeVar, comments: segComments} = this.cleanAndParseMovesWithComments(buffer);

                    // Merge segment comments with offset
                    for (const [idx, comment] of Object.entries(segComments)) {
                        currentComments[currentMoves.length + parseInt(idx)] = comment;
                    }
                    currentMoves.push(...movesBeforeVar);

                    // Store moves/comments up to this point for the variation (WITHOUT the last move)
                    movesBeforeVariation = currentMoves.slice(0, -1);
                    commentsBeforeVariation = {};
                    for (const [idx, comment] of Object.entries(currentComments)) {
                        if (parseInt(idx) < movesBeforeVariation.length) {
                            commentsBeforeVariation[parseInt(idx)] = comment;
                        }
                    }

                    // Extract the move number before this variation
                    const peekAhead = movesText.substring(i + 1, Math.min(i + 20, movesText.length));
                    const variationMoveNum = peekAhead.match(/(\d+)\.\.\./);

                    if (variationMoveNum) {
                        moveNumberBeforeVariation = parseInt(variationMoveNum[1]);
                    } else {
                        const allMoveNums = buffer.match(/(\d+)\./g);
                        if (allMoveNums && allMoveNums.length > 0) {
                            moveNumberBeforeVariation = parseInt(allMoveNums[allMoveNums.length - 1]);
                        } else {
                            moveNumberBeforeVariation = Math.floor(movesBeforeVariation.length / 2) + 1;
                        }
                    }

                    buffer = '';
                    variationStart = i + 1;
                }
                depth++;
            } else if (!inComment && char === ')') {
                depth--;
                if (depth === 0) {
                    // Extract variation text (includes comments inside it)
                    const variationText = movesText.substring(variationStart, i);

                    // Get the first move of this variation for naming (strip comments first)
                    const firstMove = this.getFirstMoveFromText(variationText);

                    if (!firstMove) {
                        console.warn('Failed to extract first move from variation:', variationText);
                    }

                    let varName;
                    if (firstMove) {
                        varName = moveNumberBeforeVariation ? `${moveNumberBeforeVariation}.${firstMove}` : firstMove;
                    } else {
                        varName = moveNumberBeforeVariation ? `${moveNumberBeforeVariation}.?` : 'Variation';
                    }

                    const fullPath = parentPath ? `${parentPath} → ${varName}` : varName;

                    // Parse the variation recursively
                    const variationResult = this.parseMovesWithVariations(
                        variationText,
                        movesBeforeVariation,
                        commentsBeforeVariation,
                        moveNumberBeforeVariation,
                        fullPath
                    );

                    if (variationResult.mainLine.length > 0) {
                        result.variations.push({
                            moves: variationResult.mainLine,
                            comments: variationResult.mainLineComments,
                            name: fullPath,
                            deviationPoint: moveNumberBeforeVariation
                        });
                    }

                    result.variations.push(...variationResult.variations);

                    variationStart = -1;
                    moveNumberBeforeVariation = null;
                    movesBeforeVariation = [];
                    commentsBeforeVariation = {};
                }
            } else if (depth === 0) {
                buffer += char;
            }
        }

        // Process remaining moves
        if (buffer.trim()) {
            const {moves: remainingMoves, comments: remainingComments} = this.cleanAndParseMovesWithComments(buffer);
            for (const [idx, comment] of Object.entries(remainingComments)) {
                currentComments[currentMoves.length + parseInt(idx)] = comment;
            }
            currentMoves.push(...remainingMoves);
        }

        result.mainLine = currentMoves;
        result.mainLineComments = currentComments;
        return result;
    }

    // Get first move from variation text for naming
    getFirstMoveFromText(text) {
        // Strip comments before processing
        text = text.replace(/\{[^}]*\}/g, '');
        // Clean the text first
        const cleaned = text.trim();
        
        // Remove the first move number if present (e.g., "10. b4" -> "b4")
        let moveText = cleaned.replace(/^\d+\.+\s*/, '');
        
        // Try to match various move patterns
        // Patterns: piece moves (Nf3, Bxe5), pawn moves (e4, exd5), castling (O-O, O-O-O)
        const patterns = [
            // Castling
            /^(O-O-O|O-O|0-0-0|0-0)/,
            // Piece moves with or without capture: Nf3, Bxe5, Qd1, etc.
            /^([KQRBN][a-h]?[1-8]?x?[a-h][1-8])/,
            // Pawn captures: exd5, axb4
            /^([a-h]x[a-h][1-8])/,
            // Pawn moves: e4, d5, a3
            /^([a-h][1-8])/
        ];
        
        for (const pattern of patterns) {
            const match = moveText.match(pattern);
            if (match) {
                // Remove annotations like +, #, !, ?
                return match[1].replace(/[+#!?]/g, '');
            }
        }
        
        // If nothing matched, try to get the first word that looks like a move
        const firstWord = moveText.split(/\s+/)[0];
        if (firstWord && firstWord.length >= 2) {
            return firstWord.replace(/[+#!?]/g, '');
        }
        
        return null;
    }

    // Parse moves and extract their associated comments from a flat text segment
    cleanAndParseMovesWithComments(movesText) {
        const moves = [];
        const comments = {};

        // Split by comment blocks, keeping the delimiters
        const segments = movesText.split(/(\{[^}]*\})/);

        for (const segment of segments) {
            if (segment.startsWith('{') && segment.endsWith('}')) {
                // Associate comment with the last move parsed so far
                if (moves.length > 0) {
                    comments[moves.length - 1] = segment.slice(1, -1).trim();
                }
            } else {
                const segMoves = this.cleanAndParseMoves(segment);
                moves.push(...segMoves);
            }
        }

        return { moves, comments };
    }

    // Clean and parse moves (without variations)
    cleanAndParseMoves(movesText) {
        // Remove move numbers (handles both "11." and "11...")
        movesText = movesText.replace(/\d+\.+\s*/g, '');
        
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