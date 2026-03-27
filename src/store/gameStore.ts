import { create } from "zustand";
import {
  isPlayerScopedAction,
  type GameAction,
  type GameSyncState,
} from "../network/gameMessages";
import { useNetworkSessionStore } from "../network/networkSessionStore";
import {
  canPlayerPeel,
  findAndRemoveTile,
  giveAllPlayersNewTile,
  moveTileToPlayerTiles as moveTileToRackForPlayer,
  placeTileOnBoard as placeTileForPlayer,
} from "../gameLogic";
import type { BoardBounds, Player, Players } from "../types/game";
import type { TileType } from "../types/tile";
import { shuffleArray } from "../utils/utils";
import { loadWordList, wordSet } from "../utils/wordList";
import { INITIAL_LETTER_POOL } from "./gameConstants";

const DEFAULT_BOARD_BOUNDS: BoardBounds = {
  minX: -12,
  maxX: 12,
  minY: -12,
  maxY: 12,
};

if (wordSet === null) {
  loadWordList();
}

const createEmptyPlayer = (playerId: string): Player => ({
  name: playerId,
  tiles: [],
  board: {},
});

export interface GameState {
  players: Players;
  letterPool: TileType[];
  hasGameStarted: boolean;
  setHasGameStarted: (started: boolean) => void;
  boardBounds: BoardBounds;
  selectedTileId: string | null;
  selectTile: (tileId: string) => void;
  placeTileOnBoard: (
    playerId: string,
    x: number,
    y: number,
    tileId: string,
  ) => void;
  moveTileToPlayerTiles: (playerId: string, tileId: string) => void;
  startGame: (playerIds: string[]) => void;
  peel: (playerId: string) => void;
  dump: (playerId: string, tileId: string) => void;
  handleNetworkAction: (action: GameAction, fromPeerId: string) => void;
  applySyncState: (gameState: GameSyncState) => void;
  getSyncState: () => GameSyncState;
  resetGame: () => void;
}

const buildSyncState = (
  state: Pick<
    GameState,
    "players" | "letterPool" | "boardBounds" | "hasGameStarted"
  >,
): GameSyncState => ({
  players: state.players,
  letterPool: state.letterPool,
  boardBounds: state.boardBounds,
  hasGameStarted: state.hasGameStarted,
});

export const useGameStore = create<GameState>((set, get) => {
  const applyPlaceTileLocally = (
    playerId: string,
    x: number,
    y: number,
    tileId: string,
  ) => {
    const { boardBounds, players } = get();
    const player = players[playerId];
    if (!player) {
      return;
    }

    const placement = placeTileForPlayer(player, tileId, x, y, boardBounds);
    if (!placement) {
      console.warn(
        `Cannot place tile. Tile ${tileId} not found for player ${playerId}.`,
      );
      return;
    }

    const { updatedPlayer, updatedBoardBounds } = placement;

    set({
      boardBounds: updatedBoardBounds,
      players: {
        ...players,
        [playerId]: updatedPlayer,
      },
      selectedTileId: null,
    });
  };

  const applyMoveTileToRackLocally = (playerId: string, tileId: string) => {
    const { players } = get();
    const player = players[playerId];
    if (!player) {
      return;
    }

    const updatedPlayer = moveTileToRackForPlayer(player, tileId);
    if (!updatedPlayer) {
      return;
    }

    set({
      players: {
        ...players,
        [playerId]: updatedPlayer,
      },
      selectedTileId: null,
    });
  };

  const applyStartGameLocally = (playerIds: string[]) => {
    if (playerIds.length === 0) {
      return;
    }

    set((state) => {
      const nextLetterPool = shuffleArray([...INITIAL_LETTER_POOL]);
      const nextPlayers: Players = {};

      for (const playerId of playerIds) {
        const initialTiles = nextLetterPool.splice(0, 21);
        const existingPlayer =
          state.players[playerId] ?? createEmptyPlayer(playerId);

        nextPlayers[playerId] = {
          ...existingPlayer,
          tiles: initialTiles,
          board: {},
        };
      }

      return {
        players: nextPlayers,
        letterPool: nextLetterPool,
        hasGameStarted: true,
        boardBounds: { ...DEFAULT_BOARD_BOUNDS },
        selectedTileId: null,
      };
    });
  };

  const applyPeelLocally = (playerId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player) {
      console.warn(`Cannot peel. Player ${playerId} was not found.`);
      return;
    }

    if (!canPlayerPeel(player, state.boardBounds)) {
      console.log("Cannot peel: player's board is invalid");
      return;
    }

    const playerCount = Object.keys(state.players).length;
    if (state.letterPool.length < playerCount) {
      console.log("Game over! Winner:", playerId);
      return;
    }

    const { updatedPlayers, updatedLetterPool } = giveAllPlayersNewTile(
      state.players,
      state.letterPool,
    );

    set({ players: updatedPlayers, letterPool: updatedLetterPool });
  };

  const applyDumpLocally = (playerId: string, tileId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player) {
      console.warn(`Cannot dump. Player ${playerId} was not found.`);
      return;
    }

    if (state.letterPool.length < 3) {
      console.log("Cannot dump: not enough tiles left");
      return;
    }

    const { tile: tileToDump, updatedPlayer } = findAndRemoveTile(
      player,
      tileId,
    );
    if (!tileToDump) {
      console.warn(
        `Cannot dump. Tile ${tileId} was not found for player ${playerId}.`,
      );
      return;
    }

    const updatedLetterPool = [...state.letterPool];
    const drawnTiles: TileType[] = [];
    for (let i = 0; i < 3; i++) {
      const tileIdx = Math.floor(Math.random() * updatedLetterPool.length);
      drawnTiles.push(updatedLetterPool.splice(tileIdx, 1)[0]);
    }
    updatedPlayer.tiles.push(...drawnTiles);
    updatedLetterPool.push(tileToDump);

    set({
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      letterPool: updatedLetterPool,
      selectedTileId: null,
    });
  };

  const broadcastSyncIfSharedStateChanged = (
    previousPlayers: Players,
    previousLetterPool: TileType[],
  ) => {
    const nextState = get();
    if (
      previousPlayers === nextState.players &&
      previousLetterPool === nextState.letterPool
    ) {
      return;
    }

    useNetworkSessionStore.getState().broadcastToGuests({
      type: "SYNC_STATE",
      gameState: nextState.getSyncState(),
    });
  };

  const applyHostAction = (action: GameAction) => {
    const previousPlayers = get().players;
    const previousLetterPool = get().letterPool;

    switch (action.type) {
      case "START_GAME":
        applyStartGameLocally(action.playerIds);
        break;
      case "PLACE_TILE":
        applyPlaceTileLocally(
          action.playerId,
          action.x,
          action.y,
          action.tileId,
        );
        break;
      case "RETURN_TILE":
        applyMoveTileToRackLocally(action.playerId, action.tileId);
        break;
      case "PEEL_REQUEST":
        applyPeelLocally(action.playerId);
        break;
      case "DUMP_REQUEST":
        applyDumpLocally(action.playerId, action.tileId);
        break;
      case "SYNC_STATE":
        return;
      default:
        return;
    }

    broadcastSyncIfSharedStateChanged(previousPlayers, previousLetterPool);
  };

  const sendGuestActionToHost = (action: GameAction) => {
    const accepted = useNetworkSessionStore.getState().sendToHost(action);
    if (!accepted) {
      console.warn(
        `Could not send action ${action.type}. Host connection is not ready yet.`,
      );
    }
  };

  const dispatchLocalAction = (action: GameAction) => {
    const { role } = useNetworkSessionStore.getState();

    if (role === "host") {
      applyHostAction(action);
      return;
    }

    if (role === "guest") {
      if (action.type === "START_GAME" || action.type === "SYNC_STATE") {
        return;
      }

      sendGuestActionToHost(action);

      if (
        action.type === "PLACE_TILE" ||
        action.type === "RETURN_TILE" ||
        action.type === "DUMP_REQUEST"
      ) {
        set({ selectedTileId: null });
      }

      return;
    }

    console.warn(`Ignored action ${action.type}; no room role is active.`);
  };

  return {
    players: {},
    letterPool: [],
    boardBounds: { ...DEFAULT_BOARD_BOUNDS },
    selectedTileId: null,
    hasGameStarted: false,
    setHasGameStarted: (started: boolean) => set({ hasGameStarted: started }),
    selectTile: (tileId: string) => {
      const { selectedTileId } = get();
      if (selectedTileId === tileId) {
        set({ selectedTileId: null });
        return;
      }

      set({ selectedTileId: tileId });
    },

    placeTileOnBoard: (playerId, x, y, tileId) => {
      dispatchLocalAction({ type: "PLACE_TILE", playerId, x, y, tileId });
    },
    moveTileToPlayerTiles: (playerId, tileId) => {
      dispatchLocalAction({ type: "RETURN_TILE", playerId, tileId });
    },
    startGame: (playerIds) => {
      dispatchLocalAction({
        type: "START_GAME",
        playerIds,
      });
    },
    peel: (playerId) => {
      dispatchLocalAction({ type: "PEEL_REQUEST", playerId });
    },
    dump: (playerId, tileId) => {
      dispatchLocalAction({ type: "DUMP_REQUEST", playerId, tileId });
    },
    handleNetworkAction: (action, fromPeerId) => {
      const { role } = useNetworkSessionStore.getState();

      if (role === "host") {
        if (action.type === "SYNC_STATE" || action.type === "START_GAME") {
          return;
        }

        if (isPlayerScopedAction(action) && action.playerId !== fromPeerId) {
          console.warn(
            `Ignoring ${action.type} from ${fromPeerId}; payload targeted ${action.playerId}.`,
          );
          return;
        }

        applyHostAction(action);
        return;
      }

      if (role === "guest") {
        if (action.type !== "SYNC_STATE") {
          return;
        }

        get().applySyncState(action.gameState);
      }
    },
    applySyncState: (gameState) => {
      set({
        players: gameState.players,
        letterPool: gameState.letterPool,
        boardBounds: gameState.boardBounds,
        hasGameStarted: gameState.hasGameStarted,
        selectedTileId: null,
      });
    },
    getSyncState: () => {
      return buildSyncState(get());
    },
    resetGame: () => {
      set({
        players: {},
        letterPool: [],
        boardBounds: { ...DEFAULT_BOARD_BOUNDS },
        selectedTileId: null,
        hasGameStarted: false,
      });
    },
  };
});
