import type { TileType } from "./tile";

export interface Player {
  name: string;
  tiles: TileType[];
  board: BoardMap;
}

export type Players = Record<string, Player>;

export interface BoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type BoardMap = Record<string, TileType>;
