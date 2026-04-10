import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { RotateCw, Settings, X, Check } from 'lucide-react';

const SYLLABLES = [
  'ba', 'bu', 'ca', 'ce', 'da', 'ga', 'ja', 'jo', 'ka', 'ki',
  'ko', 'la', 'ła', 'ma', 'na', 'no', 'pa', 'ra', 'sa', 'sy',
  'ta', 'to', 'ty', 'wa', 'za', 'ło', 'ra', 'na'
];

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ą', 'ę', 'ó']);

const VALID_WORDS = new Set([
  // ba-
  'baba', 'baza', 'baca',
  // bu-
  'buda', 'buty',
  // da-
  'data',
  // ja-
  'jama', 'jajo', 'joga',
  // ka-
  'kara', 'kasa', 'kawa', 'kino',
  // ko-
  'koło', 'koza', 'koty', 'kosa',
  // la-
  'lama', 'lato', 'lawa',
  // ła-
  'łapa', 'łata', 'ława',
  // ma-
  'mama', 'mata', 'maki', 'mapa',
  // no-
  'noce', 'noga', 'nosy', 'nora',
  // pa-
  'para',
  // ra-
  'rada', 'rama', 'rasa', 'rana', 'raca',
  // ry-
  'ryba',
  // sa-
  'sala',
  // so-
  'sowa',
  // ta-
  'taca', 'tama', 'tata',
  // wa-
  'wada', 'waga', 'wata', 'waza',
  // wo-
  'woda'
]);

// Only syllables that can appear in valid words
const SYLLABLES_WORD_MODE = [...new Set(
  Array.from(VALID_WORDS).flatMap(word => [word.slice(0, 2), word.slice(2)])
)];

/** In build-words mode, returns syllables that can complete a word with any exposed board syllable.
 * Checks both boardSyl+s (right/down) and s+boardSyl (up) directions. */
const getWordCompletions = (boardSyllables: string[]): string[] => {
  const completions = new Set<string>();
  for (const boardSyl of boardSyllables) {
    for (const s of SYLLABLES_WORD_MODE) {
      if (VALID_WORDS.has(boardSyl + s)) completions.add(s);
      if (VALID_WORDS.has(s + boardSyl)) completions.add(s);
    }
  }
  return Array.from(completions);
};

interface TileData {
  id: string;
  leftSyllable: string;
  rightSyllable: string;
  rotation: number;
  x?: number;
  y?: number;
  isOnBoard: boolean;
  connectedTick?: number;
  hasBeenConnected?: boolean;
  isSingleSyllable?: boolean;
}

const generateRandomTile = (matchingSyllables?: string[], pool: string[] = SYLLABLES): TileData => {
  let s1 = pool[Math.floor(Math.random() * pool.length)];
  let s2 = pool[Math.floor(Math.random() * pool.length)];

  if (matchingSyllables && matchingSyllables.length > 0) {
    const match = matchingSyllables[Math.floor(Math.random() * matchingSyllables.length)];
    if (Math.random() > 0.5) {
      s1 = match;
    } else {
      s2 = match;
    }
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    leftSyllable: s1,
    rightSyllable: s2,
    rotation: 0,
    isOnBoard: false,
    hasBeenConnected: false,
  };
};

const generateSingleSylTile = (syl?: string, pool: string[] = SYLLABLES_WORD_MODE): TileData => {
  const s = syl || pool[Math.floor(Math.random() * pool.length)];
  return {
    id: Math.random().toString(36).substr(2, 9),
    leftSyllable: s,
    rightSyllable: '',
    rotation: 0,
    isOnBoard: false,
    hasBeenConnected: false,
    isSingleSyllable: true,
  };
};

const getAvailableSyllables = (tiles: TileData[]): string[] => {
  const boardTiles = tiles.filter(t => t.isOnBoard && t.hasBeenConnected);
  if (boardTiles.length === 0) return [];

  const allSquares: { x: number, y: number, syl: string, tileId: string }[] = [];
  for (const t of boardTiles) {
    const rot = (t.rotation % 360 + 360) % 360;
    const rad = rot * Math.PI / 180;
    const cx = (t.x || 0) + 112;
    const cy = (t.y || 0) + 56;
    allSquares.push({
      x: Math.round(cx - 56 * Math.cos(rad)),
      y: Math.round(cy - 56 * Math.sin(rad)),
      syl: t.leftSyllable,
      tileId: t.id
    });
    allSquares.push({
      x: Math.round(cx + 56 * Math.cos(rad)),
      y: Math.round(cy + 56 * Math.sin(rad)),
      syl: t.rightSyllable,
      tileId: t.id
    });
  }

  const available: string[] = [];
  for (let i = 0; i < allSquares.length; i++) {
    const sq = allSquares[i];
    let isTaken = false;
    for (let j = 0; j < allSquares.length; j++) {
      if (i === j || sq.tileId === allSquares[j].tileId) continue;
      const dist = Math.abs(sq.x - allSquares[j].x) + Math.abs(sq.y - allSquares[j].y);
      if (dist > 100 && dist < 120) {
        isTaken = true;
        break;
      }
    }
    if (!isTaken) {
      available.push(sq.syl);
    }
  }
  return available;
};
/** In build-words mode, returns syllables from board squares that have no neighbor
 * from another tile (i.e., they are "free ends" available for new connections). */
const getExposedSyllables = (tiles: TileData[]): string[] => {
  const boardTiles = tiles.filter(t => t.isOnBoard && t.hasBeenConnected);
  if (boardTiles.length === 0) return [];

  const allSquares: { x: number, y: number, syl: string, tileId: string }[] = [];
  for (const t of boardTiles) {
    if (t.isSingleSyllable) {
      // Single-syl tile: one square
      allSquares.push({
        x: (t.x || 0) + 56,
        y: (t.y || 0) + 56,
        syl: t.leftSyllable,
        tileId: t.id
      });
    } else {
      // Normal 2-syl tile: two squares
      const rot = (t.rotation % 360 + 360) % 360;
      const rad = rot * Math.PI / 180;
      const cx = (t.x || 0) + 112;
      const cy = (t.y || 0) + 56;
      allSquares.push({
        x: Math.round(cx - 56 * Math.cos(rad)),
        y: Math.round(cy - 56 * Math.sin(rad)),
        syl: t.leftSyllable,
        tileId: t.id
      });
      allSquares.push({
        x: Math.round(cx + 56 * Math.cos(rad)),
        y: Math.round(cy + 56 * Math.sin(rad)),
        syl: t.rightSyllable,
        tileId: t.id
      });
    }
  }

  const exposed: string[] = [];
  for (const sq of allSquares) {
    // A square is exposed (free end) if it has NO neighbor from another tile
    let hasNeighborFromOtherTile = false;
    for (const other of allSquares) {
      if (sq.tileId === other.tileId) continue;
      const dist = Math.abs(sq.x - other.x) + Math.abs(sq.y - other.y);
      if (dist > 100 && dist < 120) {
        hasNeighborFromOtherTile = true;
        break;
      }
    }
    if (!hasNeighborFromOtherTile) {
      exposed.push(sq.syl);
    }
  }
  return exposed;
};

const ColoredSyllable: React.FC<{ text: string }> = ({ text }) => {
  return (
    <>
      {text.split('').map((char, index) => {
        const isVowel = VOWELS.has(char.toLowerCase());
        const color = isVowel ? 'var(--tile-text-right)' : 'var(--tile-text-left)';
        return (
          <span key={index} style={{ color }}>
            {char}
          </span>
        );
      })}
    </>
  );
};

function App() {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [glowId, setGlowId] = useState<string | null>(null);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [boardZoom, setBoardZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gameMode, setGameMode] = useState<'match-syllables' | 'build-words'>('match-syllables');

  useEffect(() => {
    const boardTiles = tiles.filter(t => t.isOnBoard && t.hasBeenConnected);
    const paletteTiles = tiles.filter(t => !t.isOnBoard);
    if (boardTiles.length > 0 && paletteTiles.length > 0) {
      const availableBoardSyllables = getAvailableSyllables(tiles);
      if (availableBoardSyllables.length > 0) {
        if (gameMode === 'match-syllables') {
          const hasMatch = paletteTiles.some(pt => availableBoardSyllables.includes(pt.leftSyllable) || availableBoardSyllables.includes(pt.rightSyllable));
          if (!hasMatch) {
            setTiles(prev => {
              const updated = [...prev];
              const pIndex = updated.findIndex(t => !t.isOnBoard);
              if (pIndex !== -1) updated[pIndex] = generateRandomTile(availableBoardSyllables, SYLLABLES);
              return updated;
            });
          }
        } else {
          // Word mode: ensure at least one palette tile can form a word with an exposed board syllable
          const exposed = getExposedSyllables(tiles);
          const uncoveredSyllables = exposed.filter(boardSyl => {
            const completions = SYLLABLES_WORD_MODE.filter(s => VALID_WORDS.has(boardSyl + s) || VALID_WORDS.has(s + boardSyl));
            return completions.length > 0 && !paletteTiles.some(pt => completions.includes(pt.leftSyllable));
          });

          if (uncoveredSyllables.length > 0) {
            setTiles(prev => {
              let updated = [...prev];
              for (const boardSyl of uncoveredSyllables) {
                const completions = SYLLABLES_WORD_MODE.filter(s => VALID_WORDS.has(boardSyl + s) || VALID_WORDS.has(s + boardSyl));
                if (completions.length === 0) continue;
                const pIndex = updated.findIndex(t => !t.isOnBoard);
                if (pIndex === -1) break;
                updated[pIndex] = generateSingleSylTile(completions[Math.floor(Math.random() * completions.length)]);
              }
              return updated;
            });
          }
        }
      }
    }
  }, [tiles, gameMode]);

  useEffect(() => {
    const handleResize = () => {
      // 1728 is the exact width of a 16-inch MacBook. By scaling rigidly against this,
      // all smaller screens (13", 14") will render proportionally 1:1 identical layouts.
      const scale = Math.min(1, window.innerWidth / 1728);
      document.documentElement.style.setProperty('--app-scale', scale.toString());
      (window as any).__appScale = scale;
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const scaleStr = document.documentElement.style.getPropertyValue('--app-scale') || '1';
      const appScale = parseFloat(scaleStr);

      const rect = el.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / appScale;
      const mouseY = (e.clientY - rect.top) / appScale;

      setBoardZoom(prevZoom => {
        const zoomFactor = Math.exp(-e.deltaY * 0.005);
        const newZoom = Math.max(0.3, Math.min(prevZoom * zoomFactor, 2.5));

        setBoardOffset(prevOffset => {
          const Wx = (mouseX - prevOffset.x) / prevZoom;
          const Wy = (mouseY - prevOffset.y) / prevZoom;

          return {
            x: mouseX - Wx * newZoom,
            y: mouseY - Wy * newZoom
          };
        });
        return newZoom;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    originWasBoard: false
  });

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // RESET GAME ON MODE CHANGE
    const currentPool = gameMode === 'match-syllables' ? SYLLABLES : SYLLABLES_WORD_MODE;
    const isWordMode = gameMode === 'build-words';

    // 1 Starter tile on the board (always a normal 2-syl domino)
    const starterTile = generateRandomTile(undefined, currentPool);
    starterTile.isOnBoard = true;
    starterTile.x = Math.round((window.innerWidth / 2 - 112) / 56) * 56;
    starterTile.y = Math.round((Math.max(100, window.innerHeight / 3 - 56)) / 56) * 56;
    starterTile.connectedTick = Date.now();
    starterTile.hasBeenConnected = true;

    // 10 tiles in palette
    const initialTiles: TileData[] = [starterTile];
    if (isWordMode) {
      // Word mode: single-syllable tiles in palette
      const starterSyls = [starterTile.leftSyllable, starterTile.rightSyllable];
      const completions = getWordCompletions(starterSyls);
      for (let i = 0; i < 10; i++) {
        if (i < 3 && completions.length > 0) {
          initialTiles.push(generateSingleSylTile(completions[Math.floor(Math.random() * completions.length)]));
        } else {
          initialTiles.push(generateSingleSylTile(undefined, currentPool));
        }
      }
    } else {
      // Match mode: normal 2-syl dominos
      for (let i = 0; i < 10; i++) {
        if (i < 3) {
          initialTiles.push(generateRandomTile([starterTile.leftSyllable, starterTile.rightSyllable], currentPool));
        } else {
          initialTiles.push(generateRandomTile(undefined, currentPool));
        }
      }
    }
    setTiles(initialTiles);
    setBoardOffset({ x: 0, y: 0 });
    setBoardZoom(1);
  }, [gameMode]);

  const handlePointerDownBoard = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tile')) return;
    if (e.button !== 0) return;

    const scale = (window as any).__appScale || 1;
    setIsPanning(true);
    dragInfo.current = {
      startX: e.clientX / scale,
      startY: e.clientY / scale,
      initialX: boardOffset.x,
      initialY: boardOffset.y,
      originWasBoard: false
    };
  };

  const handlePointerDownTile = (e: React.PointerEvent, id: string, isOnBoard: boolean) => {
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;

    // If the tile is permanently connected, ignore dragging it and do NOT stop propagation
    // This allows clicking on a connected tile to pan the entire board instead!
    if (tile.hasBeenConnected) return;

    e.preventDefault();
    e.stopPropagation(); // prevent panning on board
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.rotate-btn')) return;

    setDraggingId(id);

    let initX = tile.x || 0;
    let initY = tile.y || 0;

    if (!isOnBoard && boardRef.current) {
      const scale = (window as any).__appScale || 1;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const boardRect = boardRef.current.getBoundingClientRect();
      initX = (((rect.left - boardRect.left) / scale) - boardOffset.x) / boardZoom;
      initY = (((rect.top - boardRect.top) / scale) - boardOffset.y) / boardZoom;

      setTiles(prev => prev.map(t =>
        t.id === id ? { ...t, isOnBoard: true, x: initX, y: initY } : t
      ));
    }

    const scale = (window as any).__appScale || 1;
    dragInfo.current = {
      startX: (e.clientX / scale) / boardZoom,
      startY: (e.clientY / scale) / boardZoom,
      initialX: initX,
      initialY: initY,
      originWasBoard: isOnBoard
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const scale = (window as any).__appScale || 1;

    if (isPanning) {
      const dx = (e.clientX / scale) - dragInfo.current.startX;
      const dy = (e.clientY / scale) - dragInfo.current.startY;
      setBoardOffset({
        x: dragInfo.current.initialX + dx,
        y: dragInfo.current.initialY + dy
      });
      return;
    }

    if (!draggingId) return;

    const dx = (e.clientX / scale) / boardZoom - dragInfo.current.startX;
    const dy = (e.clientY / scale) / boardZoom - dragInfo.current.startY;

    setTiles(prev => prev.map(t => {
      if (t.id === draggingId) {
        return {
          ...t,
          x: dragInfo.current.initialX + dx,
          y: dragInfo.current.initialY + dy,
        };
      }
      return t;
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingId) {
      const draggedTile = tiles.find(t => t.id === draggingId);

      if (draggedTile && draggedTile.isOnBoard) {
        // Prevent dropping inside or over the palette area
        const palette = document.querySelector('.palette-container');
        const isOverPalette = palette && e.clientY > palette.getBoundingClientRect().top;

        const snappedX = Math.round((draggedTile.x || 0) / 56) * 56;
        const snappedY = Math.round((draggedTile.y || 0) / 56) * 56;

        const otherTiles = tiles.filter(t => t.isOnBoard && t.id !== draggingId);

        // Build board squares from all other on-board tiles
        const allBoardSquares: { x: number, y: number, syl: string, tileId: string }[] = [];
        for (const t of otherTiles) {
          if (t.isSingleSyllable) {
            allBoardSquares.push({
              x: (t.x || 0) + 56,
              y: (t.y || 0) + 56,
              syl: t.leftSyllable,
              tileId: t.id
            });
          } else {
            const trot = (t.rotation % 360 + 360) % 360;
            const trad = trot * Math.PI / 180;
            const tcx = (t.x || 0) + 112;
            const tcy = (t.y || 0) + 56;
            allBoardSquares.push({
              x: Math.round(tcx - 56 * Math.cos(trad)),
              y: Math.round(tcy - 56 * Math.sin(trad)),
              syl: t.leftSyllable,
              tileId: t.id
            });
            allBoardSquares.push({
              x: Math.round(tcx + 56 * Math.cos(trad)),
              y: Math.round(tcy + 56 * Math.sin(trad)),
              syl: t.rightSyllable,
              tileId: t.id
            });
          }
        }

        // Build dragged tile squares
        let draggedSquares: { x: number, y: number, syl: string }[];
        if (draggedTile.isSingleSyllable) {
          draggedSquares = [{ x: snappedX + 56, y: snappedY + 56, syl: draggedTile.leftSyllable }];
        } else {
          const rot = (draggedTile.rotation % 360 + 360) % 360;
          const rad = rot * Math.PI / 180;
          const cx = snappedX + 112;
          const cy = snappedY + 56;
          draggedSquares = [
            { x: Math.round(cx - 56 * Math.cos(rad)), y: Math.round(cy - 56 * Math.sin(rad)), syl: draggedTile.leftSyllable },
            { x: Math.round(cx + 56 * Math.cos(rad)), y: Math.round(cy + 56 * Math.sin(rad)), syl: draggedTile.rightSyllable }
          ];
        }

        let isOverlapping = false;
        let validConnections = 0;
        let invalidConnections = 0;
        let touchedAnyBoardSquare = false;

        for (const Asq of draggedSquares) {
          for (const Bsq of allBoardSquares) {
            const dist = Math.abs(Asq.x - Bsq.x) + Math.abs(Asq.y - Bsq.y);
            if (dist < 10) {
              isOverlapping = true;
            } else if (dist > 100 && dist < 120) {
              touchedAnyBoardSquare = true;

              if (gameMode === 'match-syllables') {
                // MATCH MODE: same syllable matching
                if (Asq.syl !== Bsq.syl) {
                  invalidConnections++;
                } else {
                  let bSqIsTaken = false;
                  for (const Csq of allBoardSquares) {
                    if (Csq.tileId === Bsq.tileId) continue;
                    const cDist = Math.abs(Bsq.x - Csq.x) + Math.abs(Bsq.y - Csq.y);
                    if (cDist > 100 && cDist < 120) {
                      bSqIsTaken = true;
                      break;
                    }
                  }
                  if (bSqIsTaken) {
                    invalidConnections++;
                  } else {
                    validConnections++;
                  }
                }
              } else if (draggedTile.isSingleSyllable) {
                // WORD MODE (single-syl tile): determine word by reading direction
                const isHorizontal = Math.abs(Asq.y - Bsq.y) < 10;
                const isVertical = Math.abs(Asq.x - Bsq.x) < 10;
                let word = '';

                if (isHorizontal) {
                  // Left-to-right reading
                  const leftSyl = Asq.x < Bsq.x ? Asq.syl : Bsq.syl;
                  const rightSyl = Asq.x < Bsq.x ? Bsq.syl : Asq.syl;
                  word = leftSyl + rightSyl;
                } else if (isVertical) {
                  // Top-to-bottom reading
                  const topSyl = Asq.y < Bsq.y ? Asq.syl : Bsq.syl;
                  const bottomSyl = Asq.y < Bsq.y ? Bsq.syl : Asq.syl;
                  word = topSyl + bottomSyl;
                }

                if (word && VALID_WORDS.has(word)) {
                  validConnections++;
                } else if (word) {
                  invalidConnections++;
                }
              } else {
                // WORD MODE (normal 2-syl tile — only starter, shouldn't be dragged)
                // Check if board square already has a neighbor
                let bSqHasNeighbor = false;
                for (const Csq of allBoardSquares) {
                  if (Csq.tileId === Bsq.tileId) continue;
                  const cDist = Math.abs(Bsq.x - Csq.x) + Math.abs(Bsq.y - Csq.y);
                  if (cDist > 100 && cDist < 120) {
                    bSqHasNeighbor = true;
                    break;
                  }
                }
                if (!bSqHasNeighbor) {
                  const isHorizontal2 = Math.abs(Asq.y - Bsq.y) < 10;
                  const isVertical2 = Math.abs(Asq.x - Bsq.x) < 10;
                  let word2 = '';
                  if (isHorizontal2) {
                    const leftSyl = Asq.x < Bsq.x ? Asq.syl : Bsq.syl;
                    const rightSyl = Asq.x < Bsq.x ? Bsq.syl : Asq.syl;
                    word2 = leftSyl + rightSyl;
                  } else if (isVertical2) {
                    const topSyl = Asq.y < Bsq.y ? Asq.syl : Bsq.syl;
                    const bottomSyl = Asq.y < Bsq.y ? Bsq.syl : Asq.syl;
                    word2 = topSyl + bottomSyl;
                  }
                  if (word2 && VALID_WORDS.has(word2)) validConnections++;
                  else if (word2) invalidConnections++;
                }
              }
            }
          }
        }

        // For single-syl tiles in word mode: reject if touching more than 1 board square
        if (draggedTile.isSingleSyllable && touchedAnyBoardSquare && (validConnections + invalidConnections) > 1) {
          invalidConnections = 1;
          validConnections = 0;
        }

        let isValid = !isOverlapping && invalidConnections === 0 && !isOverPalette;
        let hasNeighbor = validConnections > 0;

        if (otherTiles.length === 0 && !isOverPalette && invalidConnections === 0) {
          isValid = true;
          hasNeighbor = true; // Starter case
        }

        if (isValid && hasNeighbor) {
          // ACCEPT CONNECTION
          setGlowId(draggingId);
          setTimeout(() => setGlowId(null), 600);

          setTiles(prev => {
            let updated = prev.map(t =>
              t.id === draggingId ? { ...t, x: snappedX, y: snappedY, connectedTick: Date.now(), hasBeenConnected: true } : t
            );

            // Replenish palette if it wasn't connected before!
            if (!draggedTile.hasBeenConnected) {
              if (gameMode === 'match-syllables') {
                const availableBoardSyllables = getAvailableSyllables(updated);
                const newPaletteTile = generateRandomTile(availableBoardSyllables, SYLLABLES);
                updated = [...updated, newPaletteTile];
              } else {
                // Word mode: generate a single-syl tile guaranteed to form a word
                const exposed = getExposedSyllables(updated);
                const completions = getWordCompletions(exposed);
                if (completions.length > 0) {
                  const newTile = generateSingleSylTile(completions[Math.floor(Math.random() * completions.length)]);
                  updated = [...updated, newTile];
                } else {
                  updated = [...updated, generateSingleSylTile()];
                }
              }
            }
            return updated;
          });
        } else if (isValid && !hasNeighbor && !(gameMode === 'build-words' && touchedAnyBoardSquare)) {
          // FREE PLACEMENT (No connection made, just dropped freely on the board)
          setTiles(prev => prev.map(t =>
            t.id === draggingId ? { ...t, x: snappedX, y: snappedY } : t
          ));
        } else {
          // REJECT (Overlap or Mismatch)
          setTiles(prev => prev.map(t => {
            if (t.id === draggingId) {
              if (isOverPalette && !t.hasBeenConnected) {
                // User dragged the free-floating tile back to the palette zone
                return { ...t, isOnBoard: false, x: undefined, y: undefined };
              } else if (dragInfo.current.originWasBoard) {
                // Return to original board position
                return { ...t, x: dragInfo.current.initialX, y: dragInfo.current.initialY };
              } else {
                // Return to palette
                return { ...t, isOnBoard: false, x: undefined, y: undefined };
              }
            }
            return t;
          }));
        }
      }
      setDraggingId(null);
    }
  };

  const handleDoubleClickTile = (id: string, isOnBoard: boolean, hasBeenConnected: boolean) => {
    if (isOnBoard && !hasBeenConnected) {
      setTiles(prev => prev.map(t =>
        t.id === id ? { ...t, isOnBoard: false, x: undefined, y: undefined } : t
      ));
    }
  };

  const rotateTile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTiles(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, rotation: t.rotation + 90 };
      }
      return t;
    }));
  };

  return (
    <div
      className="app-container"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="header">
        <h1 className="title">Sylabo Domino z Dzieszkoła.pl</h1>
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: '1rem' }}>
          <button
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.2rem', borderRadius: '12px', border: '1px solid var(--palette-border)', background: 'var(--palette-bg)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => {
              const onBoardTiles = tiles.filter(t => t.isOnBoard);
              const currentPool = gameMode === 'match-syllables' ? SYLLABLES : SYLLABLES_WORD_MODE;
              const newPaletteTiles: TileData[] = [];

              if (gameMode === 'match-syllables') {
                const availableBoardSyllables = getAvailableSyllables(tiles);
                for (let i = 0; i < 10; i++) {
                  if (i < 5 && availableBoardSyllables.length > 0) {
                    newPaletteTiles.push(generateRandomTile(availableBoardSyllables, currentPool));
                  } else {
                    newPaletteTiles.push(generateRandomTile(undefined, currentPool));
                  }
                }
              } else {
                // Word mode: single-syl tiles with guarantees
                const exposed = getExposedSyllables(tiles);
                const completions = getWordCompletions(exposed);
                for (let i = 0; i < 10; i++) {
                  if (i < 4 && completions.length > 0) {
                    newPaletteTiles.push(generateSingleSylTile(completions[Math.floor(Math.random() * completions.length)]));
                  } else {
                    newPaletteTiles.push(generateSingleSylTile(undefined, currentPool));
                  }
                }
              }

              setTiles([...onBoardTiles, ...newPaletteTiles]);
            }}
          >
            Odśwież Opcje
          </button>
        </div>
      </div>

      <div
        className="board-area"
        ref={boardRef}
        onPointerDown={handlePointerDownBoard}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('.tile')) return;
          setBoardZoom(1);
          setBoardOffset({ x: 0, y: 0 });
        }}
        style={{
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundPosition: `${boardOffset.x}px ${boardOffset.y}px`,
          backgroundSize: `${56 * boardZoom}px ${56 * boardZoom}px`
        }}
      >
        <div style={{ transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${boardZoom})`, transformOrigin: '0 0', width: '100%', height: '100%', position: 'absolute', pointerEvents: 'none' }}>
          {tiles.filter(t => t.isOnBoard).map(tile => {
            let classes = `tile on-board`;
            if (tile.isSingleSyllable) classes += ' tile-single';
            if (draggingId === tile.id) classes += ' is-dragging';
            if (glowId === tile.id) classes += ' glow-success';

            return (
              <div
                key={tile.id}
                className={classes}
                style={{
                  left: tile.x,
                  top: tile.y,
                  transform: `rotate(${tile.rotation}deg) ${draggingId === tile.id ? 'scale(1.05)' : ''}`,
                  zIndex: draggingId === tile.id ? 100 : 10
                }}
                onPointerDown={(e) => handlePointerDownTile(e, tile.id, true)}
                onDoubleClick={() => handleDoubleClickTile(tile.id, tile.isOnBoard, !!tile.hasBeenConnected)}
              >
                {tile.isSingleSyllable ? (
                  <div className="tile-part single">
                    <ColoredSyllable text={tile.leftSyllable} />
                  </div>
                ) : (
                  <>
                    <div className="tile-part left">
                      <div style={{ transform: `rotate(${-tile.rotation}deg)`, transition: 'transform 0.2s' }}>
                        <ColoredSyllable text={tile.leftSyllable} />
                      </div>
                    </div>
                    <div className="tile-part right">
                      <div style={{ transform: `rotate(${-tile.rotation}deg)`, transition: 'transform 0.2s' }}>
                        <ColoredSyllable text={tile.rightSyllable} />
                      </div>
                    </div>
                  </>
                )}

                {(!draggingId && !tile.hasBeenConnected && gameMode === 'match-syllables') && (
                  <button
                    className="rotate-btn"
                    onClick={(e) => rotateTile(tile.id, e)}
                    style={{ transform: `rotate(${-tile.rotation}deg)` }}
                  >
                    <RotateCw size={28} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="palette-container">
        <div className="palette-glass glass">
          {tiles.filter(t => !t.isOnBoard).map(tile => (
            <div key={tile.id} className="tile-wrapper">
              <div
                className={`tile ${tile.isSingleSyllable ? 'tile-single' : ''} ${draggingId === tile.id ? 'is-dragging' : ''}`}
                onPointerDown={(e) => handlePointerDownTile(e, tile.id, false)}
                style={{ transform: draggingId === tile.id ? 'scale(1.05)' : 'none' }}
              >
                {tile.isSingleSyllable ? (
                  <div className="tile-part single"><ColoredSyllable text={tile.leftSyllable} /></div>
                ) : (
                  <>
                    <div className="tile-part left"><ColoredSyllable text={tile.leftSyllable} /></div>
                    <div className="tile-part right"><ColoredSyllable text={tile.rightSyllable} /></div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        className="settings-btn glass"
        onClick={() => setIsSettingsOpen(true)}
      >
        <Settings size={32} />
      </button>

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ustawienia</h2>
              <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <h3>Tryb gry</h3>
              <div className="mode-options">
                <button
                  className={`mode-option ${gameMode === 'match-syllables' ? 'active' : ''}`}
                  onClick={() => setGameMode('match-syllables')}
                >
                  <div className="mode-info">
                    <span className="mode-name">Dopasowanie tych samych sylab</span>
                    <span className="mode-description">Tradycyjna gra w domino, łączymy identyczne sylaby.</span>
                  </div>
                  {gameMode === 'match-syllables' && <Check className="check-icon" />}
                </button>
                <button
                  className={`mode-option ${gameMode === 'build-words' ? 'active' : ''}`}
                  onClick={() => setGameMode('build-words')}
                >
                  <div className="mode-info">
                    <span className="mode-name">Łączenie sylab w wyrazy</span>
                    <span className="mode-description">Twórz polskie słowa z dostępnych sylab.</span>
                  </div>
                  {gameMode === 'build-words' && <Check className="check-icon" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
