import { Board } from "./features/board/Board";
import { TileRack } from "./features/tileRack/TileRack";

import { GameProvider } from "./context/GameContext";


import { useRef, useEffect } from "react";

const App = () => {
  const boardContainerRef = useRef<HTMLDivElement>(null);

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
    <GameProvider>
      <div className="flex h-screen w-screen flex-col margin-auto">
        <h1 className="my-2 text-3xl font-bold text-yellow-700 drop-shadow text-center">
          Bananagrams
        </h1>
        <div
          ref={boardContainerRef}
          className="flex-1 overflow-scroll scrollbar-hide p-4"
        >
          <Board />
        </div>
        <TileRack />
      </div>
    </GameProvider>
  );
};

export default App;
