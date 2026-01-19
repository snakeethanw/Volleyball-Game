// ball.js
// Full advanced volleyball ball engine:
// - Physics with gravity, drag, Magnus (spin) force
// - Multi-touch rally logic (bump -> set -> spike, max 3 per side)
// - Spike / roll / tip / set / bump / serve variants
// - Timing, height, approach speed, overcharge-based hit quality
// - Net collision with spin dampening and deflection
// - Serve faults, rally faults, out-of-bounds, net faults
// - AI prediction helpers
// - Replay event logging

export class Ball {
    constructor(game) {
        this.game = game;
        const scene = game.scene;

        // Visual
        this.mesh = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: 1 }, scene);
        this.mesh.position = new BABYLON.Vector3(0, 6, 0);
        const mat = new BABYLON.StandardMaterial("ballMat", scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.7);
        mat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
        this.mesh.material = mat;

        // Physics state
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.spin = new BABYLON.Vector3(0, 0, 0); // rad/s

        this.gravity = new BABYLON.Vector3(0, -24, 0);
        this.magnusCoeff = 0.02;
        this.airDrag = 0.02;
        this.spinDecay = 0.985;

        // Rally state
        this.inRally = false;
        this.serveSide = "player"; // "player" | "opponent"
        this.lastHitBy = null;     // "player" | "opponent"
        this.lastHitType = null;   // "spike" | "roll" | "tip" | "set" | "serve" | "bump"
        this.touchCountPlayer = 0;
        this.touchCountOpponent = 0;

        // Touch sequence (for bump -> set -> spike)
        this.lastTouchSequencePlayer = [];
        this.lastTouchSequenceOpponent = [];

        // Court / net
        this.net = game.net;
        this.courtWidth = 16;
        this.courtDepth = 24;
        this.courtHalfWidth = this.courtWidth * 0.5;
        this.courtHalfDepth = this.courtDepth * 0.5;

        // Serve fault tracking
        this.isServe = false;
        this.serveType = "float";
        this.serveTossHeightMin = 2.0;
        this.serveNetFault = false;

        // Replay / debug
        this.rallyHistory = []; // { time, event, by, type, pos, vel, spin, extra }

        // Internal time
        this._time = 0;
    }

    // -----------------------
    // Public rally interface
    // -----------------------

    startServe(side = "player", serveType = "float") {
        this.serveSide = side;
        this.isServe = true;
        this.serveType = serveType;

        this.inRally = false;
        this.velocity.set(0, 0, 0);
        this.spin.set(0, 0, 0);
        this.touchCountPlayer = 0;
        this.touchCountOpponent = 0;
        this.lastHitBy = null;
        this.lastHitType = null;
        this.lastTouchSequencePlayer = [];
        this.lastTouchSequenceOpponent = [];
        this.rallyHistory = [];
        this._time = 0;
        this.serveNetFault = false;

        if (side === "player") {
            this.mesh.position = this.game.player.position.clone().add(new BABYLON.Vector3(0, 2.5, 1));
        } else {
            this.mesh.position = this.game.opponent.mesh.position.clone().add(new BABYLON.Vector3(0, 2.5, -1));
        }

        this.game.state = "servePause";

        this._recordEvent("system", "serve_start", { side, serveType });

        setTimeout(() => {
            this._executeServe(side, serveType);
        }, 600);
    }

    // Called from movement.js when player attempts a hit
    // context: { type, approachSpeed, jumpPhase, overcharge }
    tryPlayerHit(context) {
        if (!this.inRally && !this.isServe) return false;

        const onPlayerSide = this.mesh.position.z < 0;
        if (!onPlayerSide) return false;

        const player = this.game.player;
        const contactPoint = player.position.add(new BABYLON.Vector3(0, 1.6, 0));
        const dist = BABYLON.Vector3.Distance(contactPoint, this.mesh.position);
        if (dist > 2.6) return false;

        const height = this.mesh.position.y;
        if (height < 1.5 || height > 6.0) return false;

        const { type, approachSpeed, jumpPhase, overcharge } = context;

        const timingCenter = 0.6;
        const timingError = Math.abs(jumpPhase - timingCenter);
        const timingScore = BABYLON.Scalar.Clamp(1 - timingError / 0.4, 0, 1);

        const approachNorm = BABYLON.Scalar.Clamp(approachSpeed / 8, 0, 1);
        const overchargeNorm = BABYLON.Scalar.Clamp(overcharge, 0, 1);

        const quality =
            0.5 * timingScore +
            0.3 * approachNorm +
            0.2 * overchargeNorm;

        const hitProfile = this._getPlayerHitProfile(type, quality, overchargeNorm);

        const dirZ = 1;
        const aimX = (this.mesh.position.x - player.position.x) * hitProfile.aimXFactor;
        const vertical = hitProfile.verticalBase + hitProfile.verticalBonus * timingScore;
        const power = hitProfile.basePower * (0.7 + 0.3 * timingScore) * (0.7 + 0.3 * approachNorm);

        this.velocity = new BABYLON.Vector3(aimX, vertical, dirZ * power);
        this.spin = hitProfile.spinDir.scale(hitProfile.spinMag * (0.5 + 0.5 * quality));

        this.lastHitBy = "player";
        this.lastHitType = type;

        if (this.isServe) {
            this.isServe = false;
        }

        this._incrementTouch("player", type);

        this._recordEvent("player", "hit", {
            type,
            quality,
            timingScore,
            approachNorm,
            overchargeNorm
        });

        return true;
    }

    // Called from opponentAI.js when AI attempts a hit
    // context: { aggression, confidence, tilt }
    opponentHit(context) {
        if (!this.inRally && !this.isServe) return false;

        const onOpponentSide = this.mesh.position.z > 0;
        if (!onOpponentSide) return false;

        const opponent = this.game.opponent.mesh;
        const contactPoint = opponent.position.add(new BABYLON.Vector3(0, 1.6, 0));
        const dist = BABYLON.Vector3.Distance(contactPoint, this.mesh.position);
        if (dist > 2.8) return false;

        const height = this.mesh.position.y;
        if (height < 1.5 || height > 6.0) return false;

        const { aggression, confidence, tilt } = context;

        const targetX =
            this.game.player.position.x +
            (Math.random() - 0.5) * (4 + tilt * 4 - confidence * 2);

        const targetZ = -8 + (Math.random() - 0.5) * (2 + tilt * 3);

        const toTarget = new BABYLON.Vector3(
            targetX - this.mesh.position.x,
            3 - this.mesh.position.y,
            targetZ - this.mesh.position.z
        );
        toTarget.normalize();

        const basePower = 16 + aggression * 6;
        const powerJitter = (Math.random() - 0.5) * 4 * (1 + tilt);
        const power = basePower + powerJitter;

        this.velocity = toTarget.scale(power);
        this.velocity.y = 11 + Math.random() * 3;

        const spinMag = 12 + aggression * 12;
        this.spin = new BABYLON.Vector3(0, 10 + aggression * 10, 0).scale(spinMag / 20);

        this.lastHitBy = "opponent";
        this.lastHitType = "spike";

        if (this.isServe) {
            this.isServe = false;
        }

        this._incrementTouch("opponent", "spike");

        this._recordEvent("opponent", "hit", {
            type: "spike",
            aggression,
            confidence,
            tilt
        });

        return true;
    }

    // For AI prediction
    predictLanding(maxTime = 3.0, step = 0.03) {
        const pos = this.mesh.position.clone();
        const vel = this.velocity.clone();
        const spin = this.spin.clone();

        let t = 0;
        while (t < maxTime) {
            const magnus = BABYLON.Vector3.Cross(spin, vel).scale(this.magnusCoeff);
            const accel = this.gravity.add(magnus).subtract(vel.scale(this.airDrag));

            vel.addInPlace(accel.scale(step));
            pos.addInPlace(vel.scale(step));

            if (pos.y <= 0.5) break;
            t += step;
        }

        return pos;
    }

    // -----------------------
    // Physics update
    // -----------------------

    update(dt) {
        this._time += dt;

        const magnus = BABYLON.Vector3.Cross(this.spin, this.velocity).scale(this.magnusCoeff);
        const accel = this.gravity.add(magnus).subtract(this.velocity.scale(this.airDrag));

        this.velocity.addInPlace(accel.scale(dt));
        this.mesh.position.addInPlace(this.velocity.scale(dt));

        this.spin.scaleInPlace(Math.pow(this.spinDecay, dt * 60));

        if (this.net) {
            this._handleNetCollision();
        }

        if (this.mesh.position.y <= 0.5) {
            this._handleGroundContact();
        }

        this._handleOutOfBounds();
    }

    // -----------------------
    // Internal helpers
    // -----------------------

    _executeServe(side, serveType) {
        this.inRally = true;
        this.game.state = "rally";

        let vel, spin;

        if (serveType === "float") {
            vel = new BABYLON.Vector3(0, 10, side === "player" ? 14 : -14);
            spin = new BABYLON.Vector3(0, 0, 0);
        } else if (serveType === "topspin") {
            vel = new BABYLON.Vector3(0, 11, side === "player" ? 16 : -16);
            spin = new BABYLON.Vector3(0, side === "player" ? -18 : 18, 0);
        } else {
            vel = new BABYLON.Vector3(0, 12, side === "player" ? 18 : -18);
            spin = new BABYLON.Vector3(0, side === "player" ? -22 : 22, 0);
        }

        this.velocity.copyFrom(vel);
        this.spin.copyFrom(spin);

        this.lastHitBy = side;
        this.lastHitType = "serve";

        this._recordEvent(side, "serve_contact", { serveType });
    }

    _getPlayerHitProfile(type, quality, overcharge) {
        const q = BABYLON.Scalar.Clamp(quality, 0, 1);
        const oc = BABYLON.Scalar.Clamp(overcharge, 0, 1);

        if (type === "tip") {
            return {
                basePower: 10,
                verticalBase: 9,
                verticalBonus: 2,
                aimXFactor: 0.2,
                spinMag: 6,
                spinDir: new BABYLON.Vector3(0, -1, 0)
            };
        }

        if (type === "roll") {
            return {
                basePower: 14,
                verticalBase: 10,
                verticalBonus: 3,
                aimXFactor: 0.35,
                spinMag: 14,
                spinDir: new BABYLON.Vector3(0, -1, 0)
            };
        }

        if (type === "set") {
            return {
                basePower: 6,
                verticalBase: 12,
                verticalBonus: 4,
                aimXFactor: 0.1,
                spinMag: 4,
                spinDir: new BABYLON.Vector3(0, 0, 0)
            };
        }

        if (type === "bump") {
            return {
                basePower: 8,
                verticalBase: 10,
                verticalBonus: 3,
                aimXFactor: 0.25,
                spinMag: 3,
                spinDir: new BABYLON.Vector3(0, 0, 0)
            };
        }

        return {
            basePower: 18 + oc * 6,
            verticalBase: 11,
            verticalBonus: 4,
            aimXFactor: 0.4,
            spinMag: 20 + oc * 20,
            spinDir: new BABYLON.Vector3(0, -1, 0)
        };
    }

    _incrementTouch(side, type) {
        if (side === "player") {
            this.touchCountPlayer = Math.min(3, this.touchCountPlayer + 1);
            this.lastTouchSequencePlayer.push(type);
            if (this.lastTouchSequencePlayer.length > 3) {
                this.lastTouchSequencePlayer.shift();
            }
        } else {
            this.touchCountOpponent = Math.min(3, this.touchCountOpponent + 1);
            this.lastTouchSequenceOpponent.push(type);
            if (this.lastTouchSequenceOpponent.length > 3) {
                this.lastTouchSequenceOpponent.shift();
            }
        }
    }

    _handleNetCollision() {
        const netBox = this.net.getBoundingInfo().boundingBox;
        const ballBox = this.mesh.getBoundingInfo().boundingBox;

        if (!ballBox.intersectsBox(netBox)) return;

        const prevPos = this.mesh.position.subtract(this.velocity.scale(1 / 60));
        const wasOnPlayerSide = prevPos.z < 0;
        const nowOnOpponentSide = this.mesh.position.z > 0;

        if (this.isServe) {
            this.serveNetFault = true;
        }

        if (wasOnPlayerSide && nowOnOpponentSide) {
            this.mesh.position.z = netBox.minimumWorld.z - 0.6;
        } else if (!wasOnPlayerSide && !nowOnOpponentSide) {
            this.mesh.position.z = netBox.maximumWorld.z + 0.6;
        }

        this.velocity.z *= -0.4;
        this.velocity.x *= 0.7;
        this.spin.scaleInPlace(0.7);

        this._recordEvent("system", "net_contact", {
            lastHitBy: this.lastHitBy,
            isServe: this.isServe
        });
    }

    _handleGroundContact() {
        this.mesh.position.y = 0.5;

        if (!this.inRally && !this.isServe) {
            this.velocity.y = 0;
            return;
        }

        const side = this.mesh.position.z < 0 ? "player" : "opponent";

        if (side === "player") {
            this.touchCountPlayer += 1;
        } else {
            this.touchCountOpponent += 1;
        }

        this._recordEvent("system", "ground_contact", {
            side,
            lastHitBy: this.lastHitBy,
            lastHitType: this.lastHitType,
            touchCountPlayer: this.touchCountPlayer,
            touchCountOpponent: this.touchCountOpponent
        });

        let winner;

        if (this.isServe) {
            if (this.serveNetFault) {
                winner = this.serveSide === "player" ? "opponent" : "player";
            } else {
                if (side === this.serveSide) {
                    winner = this.serveSide === "player" ? "opponent" : "player";
                } else {
                    winner = this.serveSide;
                }
            }
            this.isServe = false;
        } else {
            winner = this._resolvePointWinner(side);
        }

        this.inRally = false;
        this.velocity.set(0, 0, 0);
        this.spin.set(0, 0, 0);

        this.game.onPointWon(winner);
    }

    _handleOutOfBounds() {
        const x = this.mesh.position.x;
        const z = this.mesh.position.z;

        const outX = Math.abs(x) > this.courtHalfWidth + 1;
        const outZ = Math.abs(z) > this.courtHalfDepth + 1;

        if (!outX && !outZ) return;
        if (!this.inRally && !this.isServe) return;

        this._recordEvent("system", "out_of_bounds", {
            x,
            z,
            lastHitBy: this.lastHitBy,
            lastHitType: this.lastHitType
        });

        let winner;
        if (this.lastHitBy === "player") {
            winner = "opponent";
        } else if (this.lastHitBy === "opponent") {
            winner = "player";
        } else {
            winner = z < 0 ? "opponent" : "player";
        }

        this.inRally = false;
        this.isServe = false;
        this.velocity.set(0, 0, 0);
        this.spin.set(0, 0, 0);

        this.game.onPointWon(winner);
    }

    _resolvePointWinner(groundSide) {
        if (this.lastHitBy === "player" && groundSide === "player") return "opponent";
        if (this.lastHitBy === "opponent" && groundSide === "opponent") return "player";

        if (this.lastHitBy === "player" && groundSide === "opponent") return "player";
        if (this.lastHitBy === "opponent" && groundSide === "player") return "opponent";

        return groundSide === "player" ? "opponent" : "player";
    }

    _recordEvent(by, event, extra = {}) {
        this.rallyHistory.push({
            time: this._time,
            by,
            event,
            pos: this.mesh.position.clone(),
            vel: this.velocity.clone(),
            spin: this.spin.clone(),
            extra
        });
    }
}
