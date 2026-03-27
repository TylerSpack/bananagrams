import { useRef, useEffect } from "react";
const BOARD_CELL_SIZE = 48;
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Tile } from "../tile/Tile";
import type { TileType } from "../../types/tile";
import { useGameStore } from "../../store/gameStore";
import { useNetworkSessionStore } from "../../network/networkSessionStore";

export interface BoardCellProps {
  row: number;
  col: number;
}

export const BoardCell = ({ row, col }: BoardCellProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const cellKey = `${col},${row}`;

  const yourPlayerId = useNetworkSessionStore((state) => state.localPeerId);

  const tile = useGameStore((state) => yourPlayerId ? state.players[yourPlayerId]?.board[cellKey] : undefined);
  const placeTileOnBoard = useGameStore((state) => state.placeTileOnBoard);
  const selectTile = useGameStore((state) => state.selectTile);
  const selectedTileId = useGameStore((state) => state.selectedTileId);

  // Drop target for the cell
  useEffect(() => {
    const el = ref.current;
    // If a tile is already placed, we don't need to set up a drop target (also prevents overwriting an existing tile)
    if (!el || tile) return;
    const cleanup = dropTargetForElements({
      element: el,
      onDrop: ({ source }) => {
        const droppedTile = source.data as TileType | undefined;
        if (droppedTile === undefined)
          throw new Error(
            "Dropped tile data was not available - this shouldn't happen.",
          );
        if (!yourPlayerId) return;

        placeTileOnBoard(yourPlayerId, col, row, droppedTile.id);
      },
    });
    return cleanup;
  }, [tile, row, col, placeTileOnBoard, yourPlayerId]);

  return (
    <div
      ref={ref}
      className={`relative flex items-center justify-center border border-black/5 bg-gray-50 transition ${!tile && !!selectedTileId ? "hover:bg-gray-100" : ""}`}
      style={{ width: BOARD_CELL_SIZE, height: BOARD_CELL_SIZE }}
      onClick={() => {
        if (!yourPlayerId) return;
        if (selectedTileId && !tile) {
          // If a tile is selected and this cell is empty, place the tile here
          placeTileOnBoard(yourPlayerId, col, row, selectedTileId);
        }
      }}
    >
      {tile ? (
        <Tile
          key={tile.id}
          tileId={tile.id}
          letter={tile.letter}
          size={BOARD_CELL_SIZE - 4}
          selectTile={selectTile}
          isTileSelected={selectedTileId === tile.id}
        />
      ) : null}
    </div>
  );
};
