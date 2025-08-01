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
  peel: (playerId: string) => void;
  dump: (playerId: string, tile: TileType) => void;
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
        const updatedBoard = { ...player.board };
        for (const tilePositionKey in updatedBoard) {
          if (updatedBoard[tilePositionKey]?.id === tile.id) {
            delete updatedBoard[tilePositionKey];
            break; // Only one tile on the board should have a matching ID
          }
        }
        // Place the new tile
        updatedBoard[`${x},${y}`] = tile;
        // Take the tile from the player's tiles
        const updatedPlayerTiles = player.tiles.filter((t) => t.id !== tile.id);
        return { ...player, board: updatedBoard, tiles: updatedPlayerTiles };
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
        // If tile is not on the board, it may be coming from the tile rack
        if (!tilePositionKey) return player; // No change if tile not found on board
        const updatedBoard = { ...player.board };
        delete updatedBoard[tilePositionKey];
        return {
          ...player,
          board: updatedBoard,
          tiles: [...player.tiles, tile],
        };
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
      const updatedLetterPool = [...state.letterPool];
      const updatedPlayers = state.players.map((player) => {
        // Can take tiles from the start of the pool since the pool is shuffled
        const initialTileCount = 21;
        const initialPlayerTiles = updatedLetterPool.splice(
          0,
          initialTileCount,
        );
        return { ...player, tiles: initialPlayerTiles };
      });
      console.log("Game started with players:", updatedPlayers);
      console.log("Updated letter pool:", updatedLetterPool);
      return { players: updatedPlayers, letterPool: updatedLetterPool };
    });
  },

  peel: (playerId) => {
    set((state) => {
      const player = state.players.find((player) => player.id === playerId);
      if (!player) throw new Error(`Player not found for peel: ${playerId}`);
      if (player.tiles.length > 0) {
        console.log("Cannot peel: player still has tiles");
        return state;
      }
      //TODO check if the player's board is valid (dictionary check, etc.)
      if (state.letterPool.length < state.players.length) {
        console.log("Game over! Winner:", playerId);
        return state;
      }

      const updatedLetterPool = [...state.letterPool];
      const updatedPlayers = state.players.map((player) => {
        const tileIdx = Math.floor(Math.random() * updatedLetterPool.length);
        const peeledTile = updatedLetterPool.splice(tileIdx, 1)[0];
        return { ...player, tiles: [...player.tiles, peeledTile] };
      });
      return { players: updatedPlayers, letterPool: updatedLetterPool };
    });
  },

  dump: (playerId, dumpedTile) => {
    set((state) => {
      if (state.letterPool.length < 3) {
        console.log("Cannot dump: not enough tiles left");
        return state;
      }
      const player = state.players.find((player) => player.id === playerId);
      if (!player) throw new Error(`Player not found for dump: ${playerId}`);
      // Remove the tile from the player's tiles
      const updatedPlayerTiles = player.tiles.filter(
        (tile) => tile.id !== dumpedTile.id,
      );
      // Randomly select 3 tiles from the pool
      const updatedLetterPool = [...state.letterPool];
      const drawnTiles: TileType[] = [];
      for (let i = 0; i < 3; i++) {
        const tileIdx = Math.floor(Math.random() * updatedLetterPool.length);
        drawnTiles.push(updatedLetterPool.splice(tileIdx, 1)[0]);
      }
      // Add the dumped tile to the pool (after drawing)
      updatedLetterPool.push(dumpedTile);
      const updatedPlayers = state.players.map((player) =>
        player.id === playerId
          ? { ...player, tiles: [...updatedPlayerTiles, ...drawnTiles] }
          : player,
      );
      return { players: updatedPlayers, letterPool: updatedLetterPool };
    });
  },
}));
