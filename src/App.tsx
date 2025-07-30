import { Board } from "./features/board/Board";
import { TileRack } from "./features/tileRack/TileRack";

import { GameProvider } from "./context/GameContext";

const App = () => {
  return (
    <GameProvider>
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-green-100">
        <h1 className="mb-4 text-3xl font-bold text-yellow-700 drop-shadow">
          Bananagrams
        </h1>
        <Board />
        <TileRack />
      </div>
    </GameProvider>
  );
};

export default App;
