
import { createContext, useState } from "react";
import type { TileType } from "../types/tile";

// Temporary ID generator for testing
const generateId = () => "asdf";


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

  const allLetters =
    "JJKKQQXXZZBBBCCCFFFHHHMMMPPPVVVWWWYYYGGGGLLLLLDDDDDDSSSSSSUUUUUUNNNNNNNNTTTTTTTTTRRRRRRRRROOOOOOOOOOOIIIIIIIIIIIIAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEE".split(
      "",
    );
  const INITIAL_LETTER_POOL: TileType[] = allLetters.map((letter, idx) => ({
    id: `${letter}-${idx}`,
    letter,
  }));

  // For testing: create Bob with 21 tiles and a random id
  const bobId = generateId();
  //Shuffle the initial letter pool to give Bob a random set of tiles
  INITIAL_LETTER_POOL.sort(() => Math.random() - 0.5);
  const bobTiles = INITIAL_LETTER_POOL.slice(0, 21);
  const bobBoard: BoardMap = {};
  const [players, setPlayers] = useState<Player[]>([
    {
      id: bobId,
      name: "Bob",
      tiles: bobTiles,
      board: bobBoard,
    },
  ]);

  // Store Bob's id for yourPlayerId
  const yourPlayerId = bobId;

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
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
