import { Board } from "./features/board/Board";
import { TileRack } from "./features/tileRack/TileRack";
import { useRef, useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import { loadWordList } from "./utils/wordList";

const App = () => {
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // TODO Get rid of calling startGame on mount
  const startGame = useGameStore((state) => state.startGame);
  const hasStarted = useRef(false);
  useEffect(() => {
    if (!hasStarted.current) {
      startGame();
      hasStarted.current = true;
    }
  }, [startGame]);

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
    loadWordList();
  }, []);

  return (
    <div className="margin-auto flex h-screen w-screen flex-col bg-gray-50">
      <header className="my-2 flex items-center justify-center gap-4">
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow">
          Bananagrams
        </h1>
      </header>
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
