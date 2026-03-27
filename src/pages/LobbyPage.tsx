import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNetworkSessionStore } from "../network/networkSessionStore";

const LobbyPage = () => {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();
  const playerId = useNetworkSessionStore((state) => state.localPeerId);

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      navigate(`/game/${roomId.trim()}?role=guest`);
    }
  };

  const handleCreateRoom = () => {
    if (!playerId) {
      console.error("User must be signed in to create a room");
      return;
    }

    const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    navigate(`/game/${newRoomId}?role=host`);
  };

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="rounded border border-gray-300 px-4 py-2"
        />
        <button
          onClick={handleJoinRoom}
          className="rounded bg-blue-500 px-4 py-2 text-white"
        >
          Join Game
        </button>
      </div>
      <button
        onClick={handleCreateRoom}
        className="rounded bg-green-500 px-4 py-2 text-white"
      >
        Create New Room
      </button>
    </div>
  );
};

export default LobbyPage;
