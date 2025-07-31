import { createContext, useState, useEffect } from "react";
import type { TileType } from "../types/tile";

const ALL_LETTERS = "JJKKQQXXZZBBBCCCFFFHHHMMMPPPVVVWWWYYYGGGGLLLLLDDDDDDSSSSSSUUUUUUNNNNNNNNTTTTTTTTTRRRRRRRRROOOOOOOOOOOIIIIIIIIIIIIAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEE".split("");
export const INITIAL_LETTER_POOL: TileType[] = ALL_LETTERS.map((letter, idx) => ({ id: `${letter}-${idx}`, letter }));
const shuffleArray = <T,>(array: T[]): T[] => { const newArr = [...array]; for (let i = newArr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArr[i], newArr[j]] = [newArr[j], newArr[i]]; } return newArr; };

export interface Player {
  id: string;
  name: string;
  tiles: TileType[];
  board: BoardMap;
}

export interface BoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type BoardMap = Record<string, TileType | null>;

export interface GameContextProps {
  players: Player[];
  yourPlayerId: string;
  boardBounds: BoardBounds;
  setBoardBounds: React.Dispatch<React.SetStateAction<BoardBounds>>;
  placeTileOnBoard: (playerId: string, x: number, y: number, tile: TileType) => void;
  moveTileToPlayerTiles: (playerId: string, tile: TileType) => void;
  initializePlayer: (name: string) => void;
  startGame: () => void;
}

export const GameContext = createContext<GameContextProps | undefined>(
  undefined,
);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Board bounds (inclusive)
  const [boardBounds, setBoardBounds] = useState<BoardBounds>({
    minX: -12,
    maxX: 12,
    minY: -12,
    maxY: 12,
  });

  // Temporary ID generator for testing
  const generateId = () => Math.random().toString(36).slice(2);

  // Pool of remaining letters
  const [letterPool, setLetterPool] = useState<TileType[]>(() => shuffleArray([...INITIAL_LETTER_POOL]));

  // Player state (add Bob for testing)
  const [players, setPlayers] = useState<Player[]>(() => {
    const shuffled = shuffleArray([...INITIAL_LETTER_POOL]);
    const bobTiles = shuffled.slice(0, 21);
    return [
      {
        id: "bob-id",
        name: "Bob",
        tiles: bobTiles,
        board: {},
      },
    ];
  });

  // Set Bob as the initial yourPlayerId
  // TODO: Replace with actual player management logic
  const [yourPlayerId, setYourPlayerId] = useState<string>("bob-id");


  // Initialize a new player
  const initializePlayer = (name: string) => {
    const newPlayer: Player = { id: generateId(), name, tiles: [], board: {} };
    setPlayers(prev => [...prev, newPlayer]);
    // On first initialize, set as current player
    // MAYBE reconsider this logic?
    if (!yourPlayerId) setYourPlayerId(newPlayer.id);
  };

  // Start game by dealing 21 tiles to each player
  const startGame = () => {
    setPlayers(prevPlayers => {
      const newPool = [...letterPool];
      const updatedPlayers = prevPlayers.map(player => {
        const initialPlayerTiles = newPool.splice(0, 21);
        return { ...player, tiles: initialPlayerTiles, board: {} };
      });
      setLetterPool(newPool);
      return updatedPlayers;
    });
  };

  // Automatically start the game on mount
  useEffect(() => {
    startGame();
  }, []);


  // Default empty space to maintain around the board
  const EMPTY_SPACE = 2;

  // Place a tile for a specific player and expand the board if needed
  const placeTileOnBoard = (playerId: string, x: number, y: number, tile: TileType) => {
    setBoardBounds((prev) => {
      let { minX, maxX, minY, maxY } = prev;
      // X axis
      if (x - minX < EMPTY_SPACE) {
        const leftDist = x - minX;
        minX -= EMPTY_SPACE - leftDist;
      } else if (maxX - x < EMPTY_SPACE) {
        const rightDist = maxX - x;
        maxX += EMPTY_SPACE - rightDist;
      }
      // Y axis
      if (y - minY < EMPTY_SPACE) {
        const topDist = y - minY;
        minY -= EMPTY_SPACE - topDist;
      } else if (maxY - y < EMPTY_SPACE) {
        const bottomDist = maxY - y;
        maxY += EMPTY_SPACE - bottomDist;
      }
      return { minX, maxX, minY, maxY };
    });
    setPlayers((prevPlayers) => {
      return prevPlayers.map((player) => {
        if (player.id !== playerId) return player;
        // Remove the tile from any previous board cell
        const newBoard = { ...player.board };
        for (const key in newBoard) {
          if (newBoard[key]?.id === tile.id) {
            delete newBoard[key];
          }
        }
        newBoard[`${x},${y}`] = tile;
        // Remove the tile from the player's tiles
        const newTiles = player.tiles.filter((t) => t.id !== tile.id);
        return { ...player, board: newBoard, tiles: newTiles };
      });
    });
  };

  // Move a tile from the board back to the player's tile rack
  const moveTileToPlayerTiles = (playerId: string, tile: TileType) => {
    setPlayers((prevPlayers) => {
      return prevPlayers.map((player) => {
        if (player.id !== playerId) return player;
        // Check if the tile exists on the board
        const boardKey = Object.keys(player.board).find(
          (key) => player.board[key]?.id === tile.id
        );
        if (!boardKey) {
          // Tile is not on the board, do nothing
          return player;
        }
        // Remove from board and add to tiles
        const newBoard = { ...player.board };
        delete newBoard[boardKey];
        return { ...player, board: newBoard, tiles: [...player.tiles, tile] };
      });
    });
  };

  return (
    <GameContext.Provider
      value={{
        players,
        yourPlayerId,
        boardBounds,
        setBoardBounds,
        placeTileOnBoard,
        moveTileToPlayerTiles,
        initializePlayer,
        startGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
