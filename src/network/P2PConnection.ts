import type {
  ActionShape,
  NetworkMessage,
  PeerConnectionFsmState,
  SignalingCandidateMessage,
  SignalingDescriptionMessage,
  SignalingMessage,
} from "./types";

type OutboundSignal =
  | { kind: "description"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

type P2PConnectionOptions<TAction extends ActionShape> = {
  localPeerId: string;
  remotePeerId: string;
  polite: boolean;
  autoCreateDataChannel: boolean;
  rtcConfig: RTCConfiguration;
  callbacks: P2PConnectionCallbacks<TAction>;
};

type P2PConnectionCallbacks<TAction extends ActionShape> = {
  publishSignal: (remotePeerId: string, signal: OutboundSignal) => void;
  onMessage: (message: NetworkMessage<TAction>, fromPeerId: string) => void;
  onStateChange?: (
    previousState: PeerConnectionFsmState,
    nextState: PeerConnectionFsmState,
  ) => void;
  onLog?: (line: string) => void;
};

export class P2PConnection<TAction extends ActionShape> {
  private readonly localPeerId: string;
  private readonly remotePeerId: string;
  private readonly polite: boolean;
  private readonly callbacks: P2PConnectionCallbacks<TAction>;
  private readonly maxPreOpenQueue = 20;
  private readonly pendingRemoteCandidates: RTCIceCandidateInit[] = [];

  private readonly pc: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private state: PeerConnectionFsmState = "idle";
  private outboundQueue: string[] = [];
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(options: P2PConnectionOptions<TAction>) {
    this.localPeerId = options.localPeerId;
    this.remotePeerId = options.remotePeerId;
    this.polite = options.polite;
    this.callbacks = options.callbacks;
    this.pc = new RTCPeerConnection(options.rtcConfig);

    this.initializePeerEventHandlers();

    if (options.autoCreateDataChannel) {
      const channel = this.pc.createDataChannel("game-data", {
        ordered: true,
      });
      this.attachDataChannel(channel);
    }
  }

  public getRemotePeerId() {
    return this.remotePeerId;
  }

  public isConnected() {
    return this.state === "connected";
  }

  public async handleIncomingSignal(signal: SignalingMessage) {
    if (this.destroyed) return;
    if (signal.kind === "description") {
      await this.handleIncomingDescription(signal);
      return;
    }

    await this.handleIncomingCandidate(signal);
  }

  public sendAction(action: TAction): boolean {
    if (this.destroyed) return false;

    const envelope: NetworkMessage<TAction> = {
      kind: "GAME_ACTION",
      action,
      senderId: this.localPeerId,
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(envelope);
    return this.sendRaw(serialized);
  }

  public destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.ondatachannel = null;

    if (this.dc) {
      this.dc.onopen = null;
      this.dc.onclose = null;
      this.dc.onmessage = null;
      this.dc.close();
      this.dc = undefined;
    }

    this.pc.close();
    this.handleStateChange("closed");
  }

  private initializePeerEventHandlers() {
    this.pc.onnegotiationneeded = async () => {
      await this.createAndSendOffer();
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      this.callbacks.publishSignal(this.remotePeerId, {
        kind: "candidate",
        candidate: candidate.toJSON(),
      });
    };

    this.pc.onconnectionstatechange = () => {
      const connectionState = this.pc.connectionState;
      switch (connectionState) {
        case "connected":
          this.clearReconnectTimer();
          this.handleStateChange("connected");
          return;
        case "connecting":
          this.handleStateChange("connecting");
          return;
        case "disconnected":
          this.handleStateChange("reconnecting");
          this.scheduleReconnect("connectionstate-disconnected");
          return;
        case "failed":
          this.handleStateChange("failed");
          void this.restartIce("connectionstate-failed");
          return;
        case "closed":
          this.handleStateChange("closed");
          return;
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc.iceConnectionState;
      if (iceState === "connected" || iceState === "completed") {
        this.clearReconnectTimer();
        return;
      }

      if (iceState === "disconnected") {
        this.scheduleReconnect("ice-disconnected");
        return;
      }

      if (iceState === "failed") {
        void this.restartIce("ice-failed");
      }
    };

    this.pc.ondatachannel = (event) => {
      this.attachDataChannel(event.channel);
    };
  }

  private attachDataChannel(channel: RTCDataChannel) {
    this.dc = channel;

    this.dc.onopen = () => {
      this.log(`DataChannel OPEN with ${this.remotePeerId}`);
      this.flushOutboundQueue();
    };

    this.dc.onclose = () => {
      this.log(`DataChannel CLOSED with ${this.remotePeerId}`);
    };

    this.dc.onmessage = (event) => {
      const message = this.parseIncomingMessage(event.data);
      if (!message) return;
      this.callbacks.onMessage(message, this.remotePeerId);
    };
  }

  private parseIncomingMessage(raw: unknown): NetworkMessage<TAction> | null {
    if (typeof raw !== "string") {
      this.log(
        `Ignoring non-string DataChannel payload from ${this.remotePeerId}`,
      );
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;

      const record = parsed as Record<string, unknown>;
      if (record.kind !== "GAME_ACTION") return null;
      if (typeof record.senderId !== "string") return null;
      if (typeof record.timestamp !== "number") return null;

      const actionValue = record.action;
      if (typeof actionValue !== "object" || actionValue === null) return null;

      const actionRecord = actionValue as Record<string, unknown>;
      if (typeof actionRecord.type !== "string") return null;

      return {
        kind: "GAME_ACTION",
        action: actionValue as TAction,
        senderId: record.senderId,
        timestamp: record.timestamp,
      };
    } catch {
      this.log(`Failed to parse inbound message from ${this.remotePeerId}`);
      return null;
    }
  }

  private sendRaw(payload: string): boolean {
    const channel = this.dc;
    if (!channel || channel.readyState !== "open") {
      this.enqueueMessage(payload);
      return false;
    }

    channel.send(payload);
    return true;
  }

  private enqueueMessage(payload: string) {
    this.outboundQueue.push(payload);
    if (this.outboundQueue.length > this.maxPreOpenQueue) {
      this.outboundQueue.shift();
      this.log(
        `Pre-open queue overflow for ${this.remotePeerId}; dropped oldest message.`,
      );
    }
  }

  private flushOutboundQueue() {
    const channel = this.dc;
    if (!channel || channel.readyState !== "open") return;

    while (this.outboundQueue.length > 0) {
      const next = this.outboundQueue.shift();
      if (!next) break;
      channel.send(next);
    }
  }

  private async createAndSendOffer(options?: RTCOfferOptions) {
    if (this.destroyed) return;

    try {
      this.makingOffer = true;
      this.handleStateChange(
        this.state === "connected" ? "reconnecting" : "signaling",
      );

      const offer = await this.pc.createOffer(options);
      await this.pc.setLocalDescription(offer);

      if (!this.pc.localDescription) return;

      this.callbacks.publishSignal(this.remotePeerId, {
        kind: "description",
        description: this.pc.localDescription.toJSON(),
      });
    } catch (error) {
      this.log(`Negotiation error with ${this.remotePeerId}: ${String(error)}`);
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleIncomingDescription(signal: SignalingDescriptionMessage) {
    const { description } = signal;
    const readyForOffer =
      !this.makingOffer &&
      (this.pc.signalingState === "stable" ||
        this.isSettingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;

    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) {
      this.log(
        `Ignoring offer collision from ${this.remotePeerId} (impolite peer).`,
      );
      return;
    }

    try {
      if (offerCollision && this.polite) {
        this.log(
          `Offer collision with ${this.remotePeerId}; rolling back local offer.`,
        );
        await Promise.all([
          this.pc.setLocalDescription({ type: "rollback" }),
          this.pc.setRemoteDescription(description),
        ]);
      } else {
        this.isSettingRemoteAnswerPending = description.type === "answer";
        await this.pc.setRemoteDescription(description);
      }

      this.isSettingRemoteAnswerPending = false;
      await this.flushPendingRemoteCandidates();

      if (description.type === "offer") {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        if (!this.pc.localDescription) return;
        this.callbacks.publishSignal(this.remotePeerId, {
          kind: "description",
          description: this.pc.localDescription.toJSON(),
        });
      }

      this.handleStateChange("connecting");
    } catch (error) {
      this.isSettingRemoteAnswerPending = false;
      this.log(
        `Signal description handling failed for ${this.remotePeerId}: ${String(error)}`,
      );
    }
  }

  private async handleIncomingCandidate(signal: SignalingCandidateMessage) {
    if (!this.pc.remoteDescription) {
      this.pendingRemoteCandidates.push(signal.candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(signal.candidate);
    } catch (error) {
      if (!this.ignoreOffer) {
        this.log(
          `Failed to add ICE candidate from ${this.remotePeerId}: ${String(error)}`,
        );
      }
    }
  }

  private async flushPendingRemoteCandidates() {
    if (!this.pc.remoteDescription || this.pendingRemoteCandidates.length === 0)
      return;

    while (this.pendingRemoteCandidates.length > 0) {
      const nextCandidate = this.pendingRemoteCandidates.shift();
      if (!nextCandidate) break;

      try {
        await this.pc.addIceCandidate(nextCandidate);
      } catch (error) {
        if (!this.pc.remoteDescription) {
          this.pendingRemoteCandidates.unshift(nextCandidate);
          return;
        }

        if (!this.ignoreOffer) {
          this.log(
            `Failed to add queued ICE candidate from ${this.remotePeerId}: ${String(error)}`,
          );
        }
      }
    }
  }

  private scheduleReconnect(reason: string) {
    if (this.reconnectTimer || this.destroyed) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.restartIce(reason);
    }, 1500);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async restartIce(reason: string) {
    if (this.destroyed) return;
    this.handleStateChange("reconnecting");
    this.log(`Restarting ICE with ${this.remotePeerId}: ${reason}`);

    try {
      this.pc.restartIce();

      if (this.pc.signalingState === "stable" && !this.makingOffer) {
        await this.createAndSendOffer({ iceRestart: true });
      }
    } catch (error) {
      this.log(`ICE restart failed for ${this.remotePeerId}: ${String(error)}`);
    }
  }

  private handleStateChange(nextState: PeerConnectionFsmState) {
    if (this.state === nextState) return;
    const previousState = this.state;
    this.state = nextState;
    this.callbacks.onStateChange?.(previousState, nextState);
  }

  private log(message: string) {
    this.callbacks.onLog?.(
      `[Peer:${this.localPeerId}->${this.remotePeerId}] ${message}`,
    );
  }
}
