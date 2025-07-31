import { Board } from "./features/board/Board";
import { TileRack } from "./features/tileRack/TileRack";
import { useRef, useEffect } from "react";
import { useGameStore } from "./store/gameStore";

const App = () => {
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // TODO Get rid of calling startGame on mount
  const startGame = useGameStore((state) => state.startGame);
  useEffect(() => {
    startGame();
  }, []);

  useEffect(() => {
    const container = boardContainerRef.current;
    if (container) {
      // Scroll to center both vertically and horizontally
      container.scrollTo({
        top: (container.scrollHeight - container.clientHeight) / 2,
        left: (container.scrollWidth - container.clientWidth) / 2,
        behavior: "auto",
      });
    }
  }, []);

  return (
    <div className="margin-auto flex h-screen w-screen flex-col bg-gray-50">
      <h1 className="my-2 text-center text-3xl font-bold text-yellow-700 drop-shadow">
        Bananagrams
      </h1>
      <div
        ref={boardContainerRef}
        className="scrollbar-hide flex-1 overflow-scroll p-4"
      >
        <Board />
      </div>
      <TileRack />
    </div>
  );
};

export default App;
