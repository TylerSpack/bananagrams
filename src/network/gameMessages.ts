import type { BoardBounds, Players } from "../types/game";
import type { TileType } from "../types/tile";

export type GameSyncState = {
  players: Players;
  letterPool: TileType[];
  boardBounds: BoardBounds;
  hasGameStarted: boolean;
};

export type StartGameAction = {
  type: "START_GAME";
  playerIds: string[];
};

export type PlaceTileAction = {
  type: "PLACE_TILE";
  playerId: string;
  x: number;
  y: number;
  tileId: string;
};

export type ReturnTileAction = {
  type: "RETURN_TILE";
  playerId: string;
  tileId: string;
};

export type PeelRequestAction = {
  type: "PEEL_REQUEST";
  playerId: string;
};

export type DumpRequestAction = {
  type: "DUMP_REQUEST";
  playerId: string;
  tileId: string;
};

export type SyncStateAction = {
  type: "SYNC_STATE";
  gameState: GameSyncState;
};

export type GameAction =
  | StartGameAction
  | PlaceTileAction
  | ReturnTileAction
  | PeelRequestAction
  | DumpRequestAction
  | SyncStateAction;

export type PlayerScopedAction =
  | PlaceTileAction
  | ReturnTileAction
  | PeelRequestAction
  | DumpRequestAction;

export function isPlayerScopedAction(
  action: GameAction,
): action is PlayerScopedAction {
  return (
    action.type === "PLACE_TILE" ||
    action.type === "RETURN_TILE" ||
    action.type === "PEEL_REQUEST" ||
    action.type === "DUMP_REQUEST"
  );
}
