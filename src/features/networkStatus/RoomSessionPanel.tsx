import { useNetworkSessionStore } from "../../network/networkSessionStore";
import type { PeerRole } from "../../network/types";
import { useGameStore } from "../../store/gameStore";

type RoomSessionPanelProps = {
  roomId: string | undefined;
  requestedRole: PeerRole;
};

export const RoomSessionPanel = ({
  roomId,
  requestedRole,
}: RoomSessionPanelProps) => {
  const playerId = useNetworkSessionStore((state) => state.localPeerId);
  const managerState = useNetworkSessionStore((state) => state.managerState);
  const connectedPeerIds = useNetworkSessionStore(
    (state) => state.connectedPeerIds,
  );
  const hasGameStarted = useGameStore((state) => state.hasGameStarted);
  const startGame = useGameStore((state) => state.startGame);

  if (!playerId) {
    return <span className="text-sm text-gray-700">You are not signed in</span>;
  }

  const roleLabel = requestedRole === "host" ? "Host" : "Guest";
  const gameStatus = hasGameStarted
    ? "Game in progress"
    : requestedRole === "host"
      ? "Ready to start"
      : "Waiting for host to start the game";

  return (
    <>
      <section className="w-full max-w-3xl rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
        <div className="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
          <span>
            <strong>Role:</strong> {roleLabel}
          </span>
          <span>
            <strong>Network:</strong> {managerState}
          </span>
          <span className="font-mono break-all md:col-span-2">
            <strong>Player ID:</strong> {playerId}
          </span>
          <span className="font-mono">
            <strong>Room ID:</strong> {roomId ?? "unknown"}
          </span>
          <span>
            <strong>Status:</strong> {gameStatus}
          </span>
        </div>
      </section>
      {requestedRole === "host" && !hasGameStarted && (
        <button
          onClick={() => startGame([playerId, ...connectedPeerIds])}
          className="rounded bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-600"
        >
          Start Game
        </button>
      )}
    </>
  );
};
