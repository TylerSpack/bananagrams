import { Board } from "../features/board/Board";
import { RoomSessionPanel } from "../features/networkStatus/RoomSessionPanel";
import { TileRack } from "../features/tileRack/TileRack";
import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useNetworkSessionStore } from "../network/networkSessionStore";
import type { PeerRole } from "../network/types";
import { useGameStore } from "../store/gameStore";

const GamePage = () => {
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedRole: PeerRole =
    searchParams.get("role") === "host" ? "host" : "guest";

  const resetGame = useGameStore((state) => state.resetGame);
  const hasGameStarted = useGameStore((state) => state.hasGameStarted);
  const playerId = useNetworkSessionStore((state) => state.localPeerId);
  const enterRoom = useNetworkSessionStore((state) => state.enterRoom);
  const leaveRoom = useNetworkSessionStore((state) => state.leaveRoom);

  useEffect(() => {
    if (!roomId || !playerId) {
      return;
    }

    enterRoom(roomId, requestedRole);

    return () => {
      leaveRoom();
      resetGame();
    };
  }, [enterRoom, leaveRoom, playerId, requestedRole, resetGame, roomId]);

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
    <div className="margin-auto flex h-screen w-full flex-col bg-gray-50">
      <header className="flex flex-col items-center justify-center gap-3 bg-yellow-200 px-4 py-3">
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-sm">
          Bananagrams
        </h1>
        <RoomSessionPanel roomId={roomId} requestedRole={requestedRole} />
      </header>
      {!hasGameStarted ? (
        <div className="text-center text-xl font-bold">
          Game has not started
        </div>
      ) : (
        <>
          <div
            ref={boardContainerRef}
            className="scrollbar-hide flex-1 overflow-scroll p-4"
          >
            <Board />
          </div>
          <TileRack />
        </>
      )}
    </div>
  );
};

export default GamePage;
