import { Board } from "./features/board/Board";
import { TileRack } from "./features/tileRack/TileRack";
import { useRef, useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import { ErrorBoundary } from "react-error-boundary";

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
  }, []);

  const letterPoolCount = useGameStore((state) => state.letterPool.length);
  const yourPlayerId = useGameStore((state) => state.yourPlayerId);
  const yourTiles = useGameStore((state) => state.players.find((p) => p.id === yourPlayerId)?.tiles || []);
  const peel = useGameStore((state) => state.peel);
  const dump = useGameStore((state) => state.dump);

  // For demo: dump the first tile in your rack
  const handleDump = () => {
    if (yourTiles.length > 0) {
      dump(yourPlayerId, yourTiles[0]);
    }
  };

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div className="flex flex-col items-center justify-center h-screen">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
          <pre className="bg-red-100 text-red-800 p-4 rounded">{error.message}</pre>
        </div>
      )}
    >
      <div className="margin-auto flex h-screen w-screen flex-col bg-gray-50">
        <header className="flex items-center justify-center gap-4 my-2">
          <h1 className="text-3xl font-bold text-yellow-700 drop-shadow">Bananagrams</h1>
          <button
            className="rounded bg-green-500 px-3 py-1 text-white font-semibold hover:bg-green-600 transition"
            onClick={() => peel(yourPlayerId)}
          >
            Peel
          </button>
          <button
            className="rounded bg-red-500 px-3 py-1 text-white font-semibold hover:bg-red-600 transition"
            onClick={handleDump}
          >
            Dump
          </button>
          <span className="ml-4 text-lg text-gray-700">Tiles left: {letterPoolCount}</span>
        </header>
        <div
          ref={boardContainerRef}
          className="scrollbar-hide flex-1 overflow-scroll p-4"
        >
          <Board />
        </div>
        <TileRack />
      </div>
    </ErrorBoundary>
  );
};

export default App;
