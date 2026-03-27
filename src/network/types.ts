export type PeerRole = "host" | "guest";

export type ManagerState =
  | "idle"
  | "initializing"
  | "ready"
  | "failed"
  | "closed";

export type PeerConnectionFsmState =
  | "idle"
  | "signaling"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

export type ActionShape = {
  type: string;
  [key: string]: unknown;
};

export type NetworkMessage<TAction extends ActionShape> = {
  kind: "GAME_ACTION";
  action: TAction;
  senderId: string;
  timestamp: number;
};

export type SignalKind = "description" | "candidate";

type SignalingMessageBase = {
  kind: SignalKind;
  fromPeerId: string;
  toPeerId: string;
  createdAt: number;
};

export type SignalingDescriptionMessage = SignalingMessageBase & {
  kind: "description";
  description: RTCSessionDescriptionInit;
};

export type SignalingCandidateMessage = SignalingMessageBase & {
  kind: "candidate";
  candidate: RTCIceCandidateInit;
};

export type SignalingMessage =
  | SignalingDescriptionMessage
  | SignalingCandidateMessage;

export type PresenceRecord = {
  role: PeerRole;
  joinedAt: number;
};

export type RoomMeta = {
  hostId: string;
  createdAt: number;
  updatedAt: number;
  state: "host-connected" | "host-disconnected";
};

export type ManagerCallbacks<TAction extends ActionShape> = {
  onMessage: (message: NetworkMessage<TAction>, fromPeerId: string) => void;
  onConnectedPeersChange?: (connectedPeerIds: string[]) => void;
  onManagerStateChange?: (state: ManagerState) => void;
  onLog?: (line: string) => void;
};
