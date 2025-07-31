import { useRef, useEffect } from "react";
const BOARD_CELL_SIZE = 48;
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Tile } from "../tile/Tile";
import type { TileType } from "../../types/tile";
import { useGameStore } from "../../store/gameStore";

export interface BoardCellProps {
  row: number;
  col: number;
  tileId: string;
  letter: string;
}

export const BoardCell: React.FC<BoardCellProps> = ({
  row,
  col,
  tileId,
  letter,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const yourPlayerId = useGameStore((state) => state.yourPlayerId);
  const placeTileOnBoard = useGameStore((state) => state.placeTileOnBoard);

  // Drop target for the cell
  useEffect(() => {
    const el = ref.current;
    // If a tile is already placed, we don't need to set up a drop target (prevents overwriting an existing tile)
    if (!el || tileId) return;
    const cleanup = dropTargetForElements({
      element: el,
      onDrop: ({ source }) => {
        const droppedTile = source.data as TileType | undefined;
        if (droppedTile === undefined)
          throw new Error(
            "Dropped tile data was not available - this shouldn't happen.",
          );

        placeTileOnBoard(yourPlayerId, col, row, droppedTile);
      },
    });
    return cleanup;
  }, [tileId, row, col, placeTileOnBoard, yourPlayerId]);

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center border border-black/5 bg-gray-50 transition"
      style={{ width: BOARD_CELL_SIZE, height: BOARD_CELL_SIZE }}
    >
      {tileId ? (
        <Tile tileId={tileId} letter={letter} size={BOARD_CELL_SIZE - 4} />
      ) : null}
    </div>
  );
};
