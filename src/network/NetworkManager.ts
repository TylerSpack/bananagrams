import {
  get,
  onChildAdded,
  onChildRemoved,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  set,
} from "firebase/database";
import { database, ensureFirebaseReady } from "./firebaseConfig";
import { P2PConnection } from "./P2PConnection";
import type {
  ActionShape,
  ManagerCallbacks,
  ManagerState,
  PeerRole,
  PresenceRecord,
  RoomMeta,
  SignalingMessage,
} from "./types";
import { parsePresence, parseRoomMeta, parseSignal } from "./helpers";

type NetworkManagerOptions<TAction extends ActionShape> = {
  roomId: string;
  localPeerId: string;
  role: PeerRole;
  callbacks: ManagerCallbacks<TAction>;
  rtcConfig?: RTCConfiguration;
};

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class NetworkManager<TAction extends ActionShape> {
  private readonly roomId: string;
  private readonly localPeerId: string;
  private readonly role: PeerRole;
  private readonly callbacks: ManagerCallbacks<TAction>;
  private readonly rtcConfig: RTCConfiguration;

  private hostId: string | null = null;
  private roomMetaState: RoomMeta["state"] | "unknown" = "unknown";
  private state: ManagerState = "idle";
  private stopped = false;

  private readonly actors = new Map<string, P2PConnection<TAction>>();
  private readonly unsubscribers: Array<() => void> = [];
  private readonly disconnectOperations: Array<
    ReturnType<typeof onDisconnect>
  > = [];

  constructor(options: NetworkManagerOptions<TAction>) {
    this.roomId = options.roomId;
    this.localPeerId = options.localPeerId;
    this.role = options.role;
    this.callbacks = options.callbacks;
    this.rtcConfig = options.rtcConfig ?? DEFAULT_RTC_CONFIG;
  }

  public getInstanceKey() {
    return `${this.roomId}:${this.localPeerId}:${this.role}`;
  }

  public async start() {
    if (this.stopped) return;
    this.setState("initializing");
    await ensureFirebaseReady();

    try {
      await this.registerRoomMembership();
      this.subscribeForInboundSignals();

      if (this.role === "host") {
        this.subscribeForGuestPresence();
      } else {
        this.subscribeForRoomMeta();
        const hostId = await this.waitForConnectedHost();
        this.roomMetaState = "host-connected";
        this.hostId = hostId;
        this.findOrCreateActor(hostId);
        this.log(`Guest locked to host ${hostId}`);
      }

      this.setState("ready");
      this.log(`Network manager ready as ${this.role} in room ${this.roomId}`);
    } catch (error) {
      this.setState("failed");
      this.log(`Failed to start network manager: ${String(error)}`);
      throw error;
    }
  }

  public stop() {
    this.log("Stopping network manager...");
    if (this.stopped) return;
    this.stopped = true;

    if (this.role === "host") {
      void this.markHostDisconnected();
    }

    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;

    for (const disconnectOperation of this.disconnectOperations) {
      void disconnectOperation.cancel().catch(() => undefined);
    }
    this.disconnectOperations.length = 0;

    for (const actor of this.actors.values()) {
      actor.destroy();
    }
    this.actors.clear();
    this.publishConnectedPeers();

    void remove(
      ref(database, `${this.roomPath()}/presence/${this.localPeerId}`),
    );

    this.setState("closed");
  }

  /// To be used by guests
  public sendActionToHost(action: TAction): boolean {
    if (!this.hostId) return false;
    const actor = this.actors.get(this.hostId);
    if (!actor) return false;
    return actor.sendAction(action);
  }

  /// To be used by host
  public sendActionToGuest(peerId: string, action: TAction): boolean {
    const actor = this.actors.get(peerId);
    if (!actor) return false;
    return actor.sendAction(action);
  }

  /// To be used by host
  public broadcastActionToGuests(action: TAction): number {
    let accepted = 0;
    for (const actor of this.actors.values()) {
      if (actor.sendAction(action)) {
        accepted += 1;
      }
    }
    return accepted;
  }

  private async registerRoomMembership() {
    if (this.role === "host") {
      await this.claimHostRole();
      this.hostId = this.localPeerId;
    }

    const presence: PresenceRecord = {
      role: this.role,
      joinedAt: Date.now(),
    };

    const presenceRef = ref(
      database,
      `${this.roomPath()}/presence/${this.localPeerId}`,
    );
    await set(presenceRef, presence);

    const presenceDisconnect = onDisconnect(presenceRef);
    await presenceDisconnect.remove();
    this.disconnectOperations.push(presenceDisconnect);
  }

  private async claimHostRole() {
    this.log("Attempting to claim host role...");
    const metaRef = ref(database, `${this.roomPath()}/meta`);
    const existingMetaSnapshot = await get(metaRef);
    const existingMeta = parseRoomMeta(existingMetaSnapshot.val());

    if (existingMeta && existingMeta.hostId !== this.localPeerId) {
      throw new Error(
        `Room ${this.roomId} already has a host (${existingMeta.hostId}).`,
      );
    }

    const now = Date.now();
    const nextMeta: RoomMeta = {
      hostId: this.localPeerId,
      createdAt: existingMeta?.createdAt ?? now,
      updatedAt: now,
      state: "host-connected",
    };
    this.log(`Claiming host role with meta: ${JSON.stringify(nextMeta)}`);

    await set(metaRef, nextMeta);
    this.roomMetaState = nextMeta.state;
  }

  private subscribeForInboundSignals() {
    const inboundRef = ref(
      database,
      `${this.roomPath()}/signals/${this.localPeerId}/messages`,
    );

    const unsubscribe = onChildAdded(inboundRef, (snapshot) => {
      const signal = parseSignal(snapshot.val());
      void remove(snapshot.ref);

      if (!signal) return;
      if (signal.toPeerId !== this.localPeerId) return;

      void this.forwardSignalToActor(signal);
    });

    this.unsubscribers.push(unsubscribe);
  }

  private async forwardSignalToActor(signal: SignalingMessage) {
    if (signal.fromPeerId === this.localPeerId) {
      this.log("Dropping self-directed signal. This should not happen.");
      return;
    }

    if (this.role === "guest" && this.roomMetaState === "host-disconnected") {
      this.log(
        `Dropping signal from ${signal.fromPeerId} because host is disconnected.`,
      );
      return;
    }

    if (
      this.role === "guest" &&
      this.hostId &&
      signal.fromPeerId !== this.hostId
    ) {
      this.log(`Ignoring signal from non-host peer ${signal.fromPeerId}`);
      return;
    }

    const actor = this.findOrCreateActor(signal.fromPeerId);
    await actor.handleIncomingSignal(signal);
  }

  /// To be used by host
  private subscribeForGuestPresence() {
    const presenceRootRef = ref(database, `${this.roomPath()}/presence`);

    const addUnsubscribe = onChildAdded(presenceRootRef, (snapshot) => {
      const peerId = snapshot.key;
      if (!peerId || peerId === this.localPeerId) return;

      const presence = parsePresence(snapshot.val());
      if (!presence || presence.role !== "guest") return;

      this.findOrCreateActor(peerId);
    });

    //TODO maybe don't remove the peer if the presence record is removed
    const removeUnsubscribe = onChildRemoved(presenceRootRef, (snapshot) => {
      const peerId = snapshot.key;
      if (!peerId) return;

      const actor = this.actors.get(peerId);
      if (!actor) return;

      actor.destroy();
      this.actors.delete(peerId);
      this.publishConnectedPeers();
      this.log(`Removed guest actor ${peerId} after presence removal.`);
    });

    this.unsubscribers.push(addUnsubscribe, removeUnsubscribe);
  }

  /// To be used by guests
  private subscribeForRoomMeta() {
    const metaRef = ref(database, `${this.roomPath()}/meta`);

    const unsubscribe = onValue(metaRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.roomMetaState = "host-disconnected";
        if (this.role === "guest") {
          this.teardownActors();
        }
        return;
      }

      const meta = parseRoomMeta(snapshot.val());
      if (!meta) return;

      this.roomMetaState = meta.state;

      if (this.role !== "guest") return;

      if (!this.hostId) {
        this.hostId = meta.hostId;
      }

      if (this.hostId !== meta.hostId) {
        this.log(
          `Ignoring hostId change from ${this.hostId} to ${meta.hostId}; reassignment is disabled.`,
        );
        return;
      }

      if (meta.state === "host-disconnected") {
        this.teardownActors();
        return;
      }

      if (!this.actors.has(meta.hostId)) {
        this.findOrCreateActor(meta.hostId);
      }
    });

    this.unsubscribers.push(unsubscribe);
  }

  private findOrCreateActor(remotePeerId: string) {
    const existing = this.actors.get(remotePeerId);
    if (existing) return existing;

    const actor = new P2PConnection<TAction>({
      localPeerId: this.localPeerId,
      remotePeerId,
      polite: this.role === "guest",
      autoCreateDataChannel: this.role === "host",
      rtcConfig: this.rtcConfig,
      callbacks: {
        publishSignal: (targetPeerId, outboundSignal) => {
          this.publishSignal(targetPeerId, outboundSignal);
        },
        onMessage: (message, fromPeerId) => {
          this.callbacks.onMessage(message, fromPeerId);
        },
        onStateChange: (previousState, nextState) => {
          if (nextState === "connected") {
            this.publishConnectedPeers();
          }
          if (previousState === "connected" && nextState !== "connected") {
            this.publishConnectedPeers();
          }
        },
        onLog: (line) => this.log(line),
      },
    });

    this.actors.set(remotePeerId, actor);
    return actor;
  }

  private publishSignal(
    toPeerId: string,
    outboundSignal:
      | { kind: "description"; description: RTCSessionDescriptionInit }
      | { kind: "candidate"; candidate: RTCIceCandidateInit },
  ) {
    this.log(
      `Publishing signal to ${toPeerId}: ${JSON.stringify(outboundSignal)}`,
    );
    if (toPeerId === this.localPeerId) {
      this.log("Skipping self-directed signal write.");
      return;
    }

    if (this.role === "guest" && this.roomMetaState !== "host-connected") {
      this.log("Guest signaling blocked because host is not connected.");
      return;
    }

    const base = {
      fromPeerId: this.localPeerId,
      toPeerId,
      createdAt: Date.now(),
    };

    const payload: SignalingMessage = { ...base, ...outboundSignal };

    const signalRef = ref(
      database,
      `${this.roomPath()}/signals/${toPeerId}/messages`,
    );
    void push(signalRef, payload).catch((error) => {
      const errorText = String(error);
      if (this.role === "guest" && errorText.includes("PERMISSION_DENIED")) {
        this.log(
          "Guest signaling blocked by rules; host appears disconnected.",
        );
        return;
      }

      this.log(`Failed to push signal to ${toPeerId}: ${String(error)}`);
    });
  }

  private teardownActors() {
    if (this.actors.size === 0) return;

    for (const actor of this.actors.values()) {
      actor.destroy();
    }

    this.actors.clear();
    this.publishConnectedPeers();
  }

  private async markHostDisconnected() {
    if (this.role !== "host") return;

    try {
      const metaRef = ref(database, `${this.roomPath()}/meta`);
      const snapshot = await get(metaRef);
      const meta = parseRoomMeta(snapshot.val());
      if (!meta) return;
      if (meta.hostId !== this.localPeerId) return;

      await set(metaRef, {
        hostId: meta.hostId,
        createdAt: meta.createdAt,
        updatedAt: Date.now(),
        state: "host-disconnected",
      } satisfies RoomMeta);

      this.roomMetaState = "host-disconnected";
    } catch (error) {
      this.log(`Failed to mark host disconnected: ${String(error)}`);
    }
  }

  private waitForConnectedHost(): Promise<string> {
    const metaRef = ref(database, `${this.roomPath()}/meta`);

    return new Promise((resolve) => {
      let settled = false;

      const unsubscribe = onValue(metaRef, (snapshot) => {
        const meta = parseRoomMeta(snapshot.val());
        if (!meta) return;
        if (meta.state !== "host-connected") return;
        if (meta.hostId.length === 0) return;
        if (settled) return;

        settled = true;
        unsubscribe();
        resolve(meta.hostId);
      });
    });
  }

  ///
  /// Small helper functions
  ///

  private setState(next: ManagerState) {
    if (this.state === next) return;
    this.state = next;
    this.callbacks.onManagerStateChange?.(next);
  }

  private publishConnectedPeers() {
    const connectedPeers = Array.from(this.actors.values())
      .filter((actor) => actor.isConnected())
      .map((actor) => actor.getRemotePeerId());
    this.callbacks.onConnectedPeersChange?.(connectedPeers);
  }

  private roomPath() {
    return `rooms/${this.roomId}`;
  }

  private log(line: string) {
    this.callbacks.onLog?.(`[Manager:${this.localPeerId}] ${line}`);
  }
}
