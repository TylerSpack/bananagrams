import { create } from "zustand";
import { useGameStore } from "../store/gameStore";
import { NetworkManager } from "./NetworkManager";
import type { GameAction } from "./gameMessages";
import type { ManagerState, PeerRole } from "./types";

type NetworkSessionState = {
  localPeerId: string | null;
  roomId: string | null;
  role: PeerRole | null;
  managerState: ManagerState;
  connectedPeerIds: string[];
  setLocalPeerId: (peerId: string | null) => void;
  enterRoom: (roomId: string, role: PeerRole) => void;
  leaveRoom: () => void;
  sendToGuest: (peerId: string, action: GameAction) => boolean;
  sendToHost: (action: GameAction) => boolean;
  broadcastToGuests: (action: GameAction) => number;
};

export const useNetworkSessionStore = create<NetworkSessionState>(
  (set, get) => {
    let manager: NetworkManager<GameAction> | null = null;

    const syncPeerStateForHost = (peerId: string) => {
      if (get().role !== "host") {
        return;
      }

      const snapshot = useGameStore.getState().getSyncState();
      manager?.sendActionToGuest(peerId, {
        type: "SYNC_STATE",
        gameState: snapshot,
      });
    };

    const disconnectManager = () => {
      manager?.stop();
      manager = null;
    };

    const connectCurrentSession = async () => {
      const { roomId, localPeerId, role } = get();
      if (!roomId || !localPeerId || !role) {
        return;
      }

      const nextKey = `${roomId}:${localPeerId}:${role}`;
      if (manager?.getInstanceKey() === nextKey) {
        return;
      }

      disconnectManager();

      set({ managerState: "initializing", connectedPeerIds: [] });

      const nextManager = new NetworkManager<GameAction>({
        roomId,
        localPeerId,
        role,
        callbacks: {
          onMessage: (message, fromPeerId) => {
            if (manager !== nextManager) {
              return;
            }
            useGameStore
              .getState()
              .handleNetworkAction(message.action, fromPeerId);
          },
          onConnectedPeersChange: (newConnectedPeerIds) => {
            if (manager !== nextManager) {
              return;
            }
            const previousConnectedPeerIds = get().connectedPeerIds;

            set({ connectedPeerIds: newConnectedPeerIds });
            console.log(
              "networkSessionStore - onConnectedPeersChange - newConnectedPeerIds:",
              newConnectedPeerIds,
            );

            if (get().role === "host") {
              const previousSet = new Set(previousConnectedPeerIds);
              const newlyConnectedPeerIds = newConnectedPeerIds.filter(
                (peerId) => !previousSet.has(peerId),
              );
              console.log(
                "networkSessionStore - onConnectedPeersChange - newlyConnectedPeerIds:",
                newlyConnectedPeerIds,
              );

              for (const peerId of newlyConnectedPeerIds) {
                syncPeerStateForHost(peerId);
                console.log(
                  `networkSessionStore - onConnectedPeersChange - Synced state to newly connected peer: ${peerId}`,
                );
              }
            }
          },
          onManagerStateChange: (managerState) => {
            if (manager !== nextManager) {
              return;
            }
            set({ managerState });
          },
          onLog: (line) => {
            console.log(line);
          },
        },
      });

      manager = nextManager;

      try {
        await nextManager.start();
      } catch (error) {
        console.error("Failed to connect network session", error);
        set({ managerState: "failed" });
      }
    };

    return {
      localPeerId: null,
      roomId: null,
      role: null,
      managerState: "idle",
      connectedPeerIds: [],
      setLocalPeerId: (localPeerId) => {
        const { localPeerId: currentPeerId, roomId, role } = get();
        if (currentPeerId === localPeerId) {
          return;
        }

        // TODO - is this intentional to disconnect manager? see where setLocalPeerId is used
        if (!localPeerId) {
          disconnectManager();
          set({
            localPeerId: null,
            roomId: null,
            role: null,
            managerState: "idle",
            connectedPeerIds: [],
          });
          return;
        }

        set({
          localPeerId,
          managerState: roomId && role ? "initializing" : "idle",
          connectedPeerIds: roomId && role ? [] : get().connectedPeerIds,
        });
        void connectCurrentSession();
      },
      enterRoom: (roomId, role) => {
        const { roomId: activeRoomId, role: activeRole, localPeerId } = get();
        if (activeRoomId === roomId && activeRole === role) {
          return;
        }

        set({
          roomId,
          role,
          managerState: localPeerId ? "initializing" : "idle",
          connectedPeerIds: [],
        });
        void connectCurrentSession();
      },
      leaveRoom: () => {
        disconnectManager();
        set({
          roomId: null,
          role: null,
          managerState: "idle",
          connectedPeerIds: [],
        });
      },
      sendToGuest: (peerId, action) => {
        return manager?.sendActionToGuest(peerId, action) ?? false;
      },
      sendToHost: (action) => {
        return manager?.sendActionToHost(action) ?? false;
      },
      broadcastToGuests: (action) => {
        return manager?.broadcastActionToGuests(action) ?? 0;
      },
    };
  },
);
