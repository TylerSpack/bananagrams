import type { TileType } from "./tile";

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