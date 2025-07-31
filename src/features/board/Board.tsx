import { BoardCell } from "./BoardCell";
import { useContext } from "react";
import { GameContext } from "../../context/GameContext";

export const Board: React.FC = () => {

  const game = useContext(GameContext);
  if (!game) throw new Error("GameContext not found");
  const { players, yourPlayerId, boardBounds } = game;
  const board = players.find((p) => p.id === yourPlayerId)?.board;
  if (!board) throw new Error("Your player not found in GameContext");
  const { minX, maxX, minY, maxY } = boardBounds;

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
  return <div className="flex w-max min-w-full flex-col">{rows}</div>;
};
