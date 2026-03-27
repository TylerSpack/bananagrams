import type { PresenceRecord, RoomMeta, SignalingMessage } from "./types";

export function parseSignal(raw: unknown): SignalingMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  if (typeof record.fromPeerId !== "string") return null;
  if (typeof record.toPeerId !== "string") return null;
  if (typeof record.createdAt !== "number") return null;

  if (record.kind === "description") {
    const description = record.description;
    if (typeof description !== "object" || description === null) return null;

    return {
      kind: "description",
      fromPeerId: record.fromPeerId,
      toPeerId: record.toPeerId,
      createdAt: record.createdAt,
      description: description as RTCSessionDescriptionInit,
    };
  }

  if (record.kind === "candidate") {
    const candidate = record.candidate;
    if (typeof candidate !== "object" || candidate === null) return null;

    return {
      kind: "candidate",
      fromPeerId: record.fromPeerId,
      toPeerId: record.toPeerId,
      createdAt: record.createdAt,
      candidate: candidate as RTCIceCandidateInit,
    };
  }

  return null;
}

export function parseRoomMeta(raw: unknown): RoomMeta | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  if (typeof record.hostId !== "string") return null;
  if (typeof record.createdAt !== "number") return null;
  if (typeof record.updatedAt !== "number") return null;
  if (record.state !== "host-connected" && record.state !== "host-disconnected")
    return null;

  return {
    hostId: record.hostId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    state: record.state,
  };
}

export function parsePresence(raw: unknown): PresenceRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  if (record.role !== "host" && record.role !== "guest") return null;
  if (typeof record.joinedAt !== "number") return null;

  return {
    role: record.role,
    joinedAt: record.joinedAt,
  };
}
