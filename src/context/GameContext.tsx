import { createContext, useState } from "react";
import type { TileType } from "../types/tile";

export type BoardMap = Record<string, TileType | null>;

export interface BoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GameContextProps {
  board: BoardMap;
  tiles: TileType[];
  setTiles: React.Dispatch<React.SetStateAction<TileType[]>>;
  boardBounds: BoardBounds;
  setBoardBounds: React.Dispatch<React.SetStateAction<BoardBounds>>;
  placeTileOnBoard: (x: number, y: number, tile: TileType) => void;
}

export const GameContext = createContext<GameContextProps | undefined>(
  undefined,
);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Board bounds (inclusive)
  const [boardBounds, setBoardBounds] = useState<BoardBounds>({
    minX: -12,
    maxX: 12,
    minY: -12,
    maxY: 12,
  });

  const letterPool =
    "JJKKQQXXZZBBBCCCFFFHHHMMMPPPVVVWWWYYYGGGGLLLLLDDDDDDSSSSSSUUUUUUNNNNNNNNTTTTTTTTTRRRRRRRRROOOOOOOOOOOIIIIIIIIIIIIAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEE".split(
      "",
    );
  const INITIAL_TILES: TileType[] = letterPool.map((letter, idx) => ({
    id: `${letter}-${idx}`,
    letter,
  }));
  const [tiles, setTiles] = useState<TileType[]>(INITIAL_TILES);

  // Board is a sparse object: only set keys for occupied cells
  const [board, setBoard] = useState<BoardMap>({});

  // Default empty space to maintain around the board
  const EMPTY_SPACE = 2;

  // Place a tile and expand the board if needed
  const placeTileOnBoard = (x: number, y: number, tile: TileType) => {
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
    setBoard((prev) => {
      // Remove the tile from any previous board cell using delete
      const newBoard = { ...prev };
      for (const key in newBoard) {
        if (newBoard[key]?.id === tile.id) {
          delete newBoard[key];
        }
      }
      newBoard[`${x},${y}`] = tile;
      return newBoard;
    });
  };

  return (
    <GameContext.Provider
      value={{
        board,
        tiles,
        setTiles,
        boardBounds,
        setBoardBounds,
        placeTileOnBoard,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
