import { BoardCell } from "./BoardCell";
import { useGameStore } from "../../store/gameStore";

export const Board: React.FC = () => {
  const yourPlayerId = useGameStore((state) => state.yourPlayerId);
  const boardBounds = useGameStore((state) => state.boardBounds);
  const { minX, maxX, minY, maxY } = boardBounds;
  const board = useGameStore(
    (state) => state.players.find((p) => p.id === yourPlayerId)?.board,
  );
  if (!board) throw new Error("Your player not found in game store");

  const rows = [];
  for (let y = minY; y <= maxY; y++) {
    const cells = [];
    for (let x = minX; x <= maxX; x++) {
      const cell = board[`${x},${y}`];
      cells.push(
        <BoardCell
          key={`${x},${y}`}
          row={y}
          col={x}
          tileId={cell?.id ?? ""}
          letter={cell?.letter ?? ""}
        />,
      );
    }
    rows.push(
      <div className="flex" key={y}>
        {cells}
      </div>,
    );
  }
  return (
    <div className="flex w-max min-w-full flex-col items-center">{rows}</div>
  );
};
