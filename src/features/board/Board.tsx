import { BoardCell } from "./BoardCell";
import { useGameStore } from "../../store/gameStore";

export const Board = () => {
  const boardBounds = useGameStore((state) => state.boardBounds);
  const { minX, maxX, minY, maxY } = boardBounds;

  const rows = [];
  for (let y = minY; y <= maxY; y++) {
    const cells = [];
    for (let x = minX; x <= maxX; x++) {
      cells.push(<BoardCell key={`${x},${y}`} row={y} col={x} />);
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
