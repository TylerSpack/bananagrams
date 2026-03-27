import { HashRouter, Routes, Route } from "react-router-dom";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import { useEffect } from "react";
import { auth } from "./network/firebaseConfig";
import { useNetworkSessionStore } from "./network/networkSessionStore";

const App = () => {
  const playerId = useNetworkSessionStore((state) => state.localPeerId);
  const setPlayerId = useNetworkSessionStore((state) => state.setLocalPeerId);

  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      if (user) {
        setPlayerId(user.uid);
      } else {
        setPlayerId(null);
      }
    });
  }, [setPlayerId]);

  if (!playerId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-gray-500">Signing in...</p>
      </div>
    );
  }

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </HashRouter>
    </>
  );
};

export default App;
