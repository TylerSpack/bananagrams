import { create } from "zustand";
import type { TileType } from "../types/tile";
import type { BoardBounds, Player } from "../types/game";
import { generateId, shuffleArray } from "../utils/utils";
import { EMPTY_CELLS_AROUND_BOARD, INITIAL_LETTER_POOL } from "./gameConstants";

interface GameState {
  players: Player[];
  yourPlayerId: string;
  boardBounds: BoardBounds;
  letterPool: TileType[];
  placeTileOnBoard: (
    playerId: string,
    x: number,
    y: number,
    tile: TileType,
  ) => void;
  moveTileToPlayerTiles: (playerId: string, tile: TileType) => void;
  initializePlayer: (name: string) => void;
  startGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  boardBounds: { minX: -12, maxX: 12, minY: -12, maxY: 12 },
  letterPool: shuffleArray([...INITIAL_LETTER_POOL]),
  // TODO Get rid of initial player and yourPlayerId
  players: [
    {
      id: "bob-id",
      name: "Bob",
      tiles: [],
      board: {},
    },
  ],
  yourPlayerId: "bob-id",

  // Tile goes from your tiles -> your board
  placeTileOnBoard: (playerId, x, y, tile) => {
    const { boardBounds, players } = get();

    // Ensure the board bounds are expanded if necessary
    let { minX, maxX, minY, maxY } = boardBounds;
    if (x - minX < EMPTY_CELLS_AROUND_BOARD)
      minX -= EMPTY_CELLS_AROUND_BOARD - (x - minX);
    else if (maxX - x < EMPTY_CELLS_AROUND_BOARD)
      maxX += EMPTY_CELLS_AROUND_BOARD - (maxX - x);
    if (y - minY < EMPTY_CELLS_AROUND_BOARD)
      minY -= EMPTY_CELLS_AROUND_BOARD - (y - minY);
    else if (maxY - y < EMPTY_CELLS_AROUND_BOARD)
      maxY += EMPTY_CELLS_AROUND_BOARD - (maxY - y);

    set({
      boardBounds: { minX, maxX, minY, maxY },
      players: players.map((player) => {
        if (player.id !== playerId) return player;
        const newBoard = { ...player.board };
        for (const tilePositionKey in newBoard) {
          if (newBoard[tilePositionKey]?.id === tile.id) {
            delete newBoard[tilePositionKey];
            break; // Only one tile on the board should have a matching ID
          }
        }
        // Place the new tile
        newBoard[`${x},${y}`] = tile;
        // Take the tile from the player's tiles
        const newTiles = player.tiles.filter((t) => t.id !== tile.id);
        return { ...player, board: newBoard, tiles: newTiles };
      }),
    });
  },

  // Tile goes from your board -> your tiles
  moveTileToPlayerTiles: (playerId, tile) => {
    set((state) => ({
      players: state.players.map((player) => {
        if (player.id !== playerId) return player;
        const tilePositionKey = Object.keys(player.board).find(
          (key) => player.board[key]?.id === tile.id,
        );
        if (!tilePositionKey)
          throw new Error("Tile not found on board - this shouldn't happen");
        const newBoard = { ...player.board };
        delete newBoard[tilePositionKey];
        return { ...player, board: newBoard, tiles: [...player.tiles, tile] };
      }),
    }));
  },

  initializePlayer: (name) => {
    set((state) => ({
      players: [
        ...state.players,
        { id: generateId(), name, tiles: [], board: {} },
      ],
    }));
  },

  startGame: () => {
    set((state) => {
      const newPool = [...state.letterPool];
      const updatedPlayers = state.players.map((player) => {
        // Can take tiles from the start of the pool since the pool is shuffled
        const initialTileCount = 21;
        const initialPlayerTiles = newPool.splice(0, initialTileCount);
        return { ...player, tiles: initialPlayerTiles };
      });
      return { players: updatedPlayers, letterPool: newPool };
    });
  },
}));
