import { useRef, useEffect, useContext } from "react";
const BOARD_CELL_SIZE = 48;
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { GameContext } from "../../context/GameContext";
import { Tile } from "../tile/Tile";
import type { TileType } from "../../types/tile";

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
  const game = useContext(GameContext);
  if (!game) throw new Error("GameContext not found");
  const { setTiles, placeTileOnBoard } = game;

  // Drop target for the cell
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = dropTargetForElements({
      element: el,
      onDrop: ({ source }) => {
        const droppedTile = source.data as TileType | undefined;
        if (!droppedTile) return; // This should not happen, but just in case

        placeTileOnBoard(col, row, droppedTile);
        //MAYBE don't need to do this every time since a tile may come from the board
        setTiles((prevTiles) =>
          prevTiles.filter((tile) => tile.id !== droppedTile.id),
        );
      },
      canDrop: () => !tileId,
    });
    return cleanup;
  }, [tileId, row, col, placeTileOnBoard, setTiles]);

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center border border-black/10 bg-green-50 transition"
      style={{ width: BOARD_CELL_SIZE, height: BOARD_CELL_SIZE}}
    >
      {tileId ? <Tile tileId={tileId} letter={letter} size={BOARD_CELL_SIZE - 4} /> : null}
    </div>
  );
};
