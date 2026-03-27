import { EMPTY_CELLS_AROUND_BOARD } from "./store/gameConstants";
import type { BoardBounds, BoardMap, Player, Players } from "./types/game";
import type { TileType } from "./types/tile";
import { isWordValid } from "./utils/wordList";

function expandBoardBoundsIfNeeded(
  boardBounds: BoardBounds,
  x: number,
  y: number,
): BoardBounds {
  let { minX, maxX, minY, maxY } = boardBounds;
  if (x - minX < EMPTY_CELLS_AROUND_BOARD)
    minX -= EMPTY_CELLS_AROUND_BOARD - (x - minX);
  else if (maxX - x < EMPTY_CELLS_AROUND_BOARD)
    maxX += EMPTY_CELLS_AROUND_BOARD - (maxX - x);
  if (y - minY < EMPTY_CELLS_AROUND_BOARD)
    minY -= EMPTY_CELLS_AROUND_BOARD - (y - minY);
  else if (maxY - y < EMPTY_CELLS_AROUND_BOARD)
    maxY += EMPTY_CELLS_AROUND_BOARD - (maxY - y);

  const updatedBoardBounds =
    minX !== boardBounds.minX ||
    maxX !== boardBounds.maxX ||
    minY !== boardBounds.minY ||
    maxY !== boardBounds.maxY
      ? { minX, maxX, minY, maxY }
      : boardBounds;
  return updatedBoardBounds;
}

export function findAndRemoveTile(
  player: Player,
  tileId: string,
): { tile: TileType | null; updatedPlayer: Player } {
  let tile: TileType | null = null;

  const tileIndexInTiles = player.tiles.findIndex((t) => t.id === tileId);
  if (tileIndexInTiles !== -1) {
    tile = player.tiles[tileIndexInTiles];
    const newTiles = [...player.tiles];
    newTiles.splice(tileIndexInTiles, 1);
    return {
      tile,
      updatedPlayer: {
        ...player,
        tiles: newTiles,
      },
    };
  }

  const tilePositionKey = Object.keys(player.board).find(
    (key) => player.board[key].id === tileId,
  );
  if (tilePositionKey) {
    tile = player.board[tilePositionKey];
    const newBoard = { ...player.board };
    delete newBoard[tilePositionKey];
    return {
      tile,
      updatedPlayer: {
        ...player,
        board: newBoard,
      },
    };
  }

  return { tile: null, updatedPlayer: player };
}

function handlePlaceTile(
  board: BoardMap,
  x: number,
  y: number,
  tile: TileType,
): BoardMap {
  const newBoard = { ...board };
  newBoard[`${x},${y}`] = tile;
  return newBoard;
}

export function placeTileOnBoard(
  player: Player,
  tileId: string,
  x: number,
  y: number,
  boardBounds: BoardBounds,
): { updatedPlayer: Player; updatedBoardBounds: BoardBounds } | undefined {
  const updatedBoardBounds = expandBoardBoundsIfNeeded(boardBounds, x, y);
  const { tile, updatedPlayer } = findAndRemoveTile(player, tileId);
  if (!tile) {
    return;
  }
  return {
    updatedPlayer: {
      ...updatedPlayer,
      board: handlePlaceTile(updatedPlayer.board, x, y, tile),
    },
    updatedBoardBounds,
  };
}

export function moveTileToPlayerTiles(
  player: Player,
  tileId: string,
): Player | undefined {
  const tilePositionKey = Object.keys(player.board).find(
    (key) => player.board[key].id === tileId,
  );
  if (!tilePositionKey) {
    return;
  }
  const tile = player.board[tilePositionKey];
  const newBoard = { ...player.board };
  delete newBoard[tilePositionKey];
  return {
    ...player,
    board: newBoard,
    tiles: [...player.tiles, tile],
  };
}

function isBoardConnected(board: BoardMap): boolean {
  const visitedKeys = new Set<string>();
  const stack: string[] = [];
  const startKey = Object.keys(board)[0];
  if (!startKey) return false;
  stack.push(startKey);
  while (stack.length > 0) {
    const currentKey = stack.pop()!;
    if (visitedKeys.has(currentKey)) continue;
    visitedKeys.add(currentKey);

    const [x, y] = currentKey.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const neighborKey = `${x + dx},${y + dy}`;
      if (board[neighborKey]) {
        stack.push(neighborKey);
      }
    }
  }
  for (const key in board) {
    if (!visitedKeys.has(key)) {
      return false;
    }
  }
  return true;
}

function boardHasValidWords(board: BoardMap, boardBounds: BoardBounds) {
  const { minX, maxX, minY, maxY } = boardBounds;

  for (let y = minY; y <= maxY; y++) {
    let tempWord = "";
    for (let x = minX; x <= maxX; x++) {
      const cellKey = `${x},${y}`;
      if (board[cellKey]) {
        tempWord += board[cellKey].letter;
      } else if (tempWord.length === 1) {
        tempWord = "";
      } else if (tempWord.length > 1) {
        if (!isWordValid(tempWord)) {
          return false;
        }
        tempWord = "";
      }
    }
    if (tempWord.length > 1 && !isWordValid(tempWord)) return false;
  }

  for (let x = minX; x <= maxX; x++) {
    let tempWord = "";
    for (let y = minY; y <= maxY; y++) {
      const cellKey = `${x},${y}`;
      if (board[cellKey]) {
        tempWord += board[cellKey].letter;
      } else if (tempWord.length === 1) {
        tempWord = "";
      } else if (tempWord.length > 1) {
        if (!isWordValid(tempWord)) {
          return false;
        }
        tempWord = "";
      }
    }
    if (tempWord.length > 1 && !isWordValid(tempWord)) return false;
  }

  return true;
}

export function canPlayerPeel(
  player: Player,
  boardBounds: BoardBounds,
): boolean {
  if (player.tiles.length > 0) return false;
  if (!isBoardConnected(player.board)) return false;
  if (!boardHasValidWords(player.board, boardBounds)) return false;
  return true;
}

export function giveAllPlayersNewTile(
  players: Players,
  letterPool: TileType[],
): { updatedPlayers: Players; updatedLetterPool: TileType[] } {
  const updatedLetterPool = [...letterPool];
  const updatedPlayers: Players = {};
  for (const playerId in players) {
    const tileIdx = Math.floor(Math.random() * updatedLetterPool.length);
    const peeledTile = updatedLetterPool.splice(tileIdx, 1)[0];
    updatedPlayers[playerId] = {
      ...players[playerId],
      tiles: [...players[playerId].tiles, peeledTile],
    };
  }
  return { updatedPlayers, updatedLetterPool };
}

export function isBoardValid(
  board: BoardMap,
  boardBounds: BoardBounds,
): boolean {
  if (Object.keys(board).length === 0) {
    return false;
  }

  if (!isBoardConnected(board)) {
    return false;
  }

  return boardHasValidWords(board, boardBounds);
}
