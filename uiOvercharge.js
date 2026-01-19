// uiOvercharge.js — Babylon.js GUI Overcharge Meter
// Hybrid S1 + S4 esports bar with angled ends, neon outline, gradient fill, pulse at high charge

export class UIOvercharge {
    constructor(game) {
        this.game = game;

        // Create fullscreen GUI layer
        this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UIOvercharge");

        // Root container
        this.container = new BABYLON.GUI.Rectangle("overchargeContainer");
        this.container.width = "40%";
        this.container.height = "40px";
        this.container.thickness = 0;
        this.container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.container.top = "-40px"; // lift slightly above bottom
        this.ui.addControl(this.container);

        // Outer neon frame
        this.frame = new BABYLON.GUI.Rectangle("overchargeFrame");
        this.frame.width = 1;
        this.frame.height = 1;
        this.frame.thickness = 3;
        this.frame.color = "#00eaff"; // neon cyan
        this.frame.cornerRadius = 12; // soft angled ends
        this.frame.alpha = 0.9;
        this.container.addControl(this.frame);

        // Fill bar (masked inside frame)
        this.fill = new BABYLON.GUI.Rectangle("overchargeFill");
        this.fill.width = "0%"; // dynamic
        this.fill.height = 1;
        this.fill.thickness = 0;
        this.fill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.fill.cornerRadius = 12;

        // Gradient fill
        const gradient = new BABYLON.GUI.LinearGradient(0, 0, 1, 0);
        gradient.addColorStop(0, "#ffe066"); // yellow
        gradient.addColorStop(0.5, "#ff8c42"); // orange
        gradient.addColorStop(1, "#ff3b3b"); // red
        this.fill.backgroundGradient = gradient;

        this.frame.addControl(this.fill);

        // Pulse animation at high charge
        this.pulseAnim = null;

        this.visible = true;
        this.charge = 0;
    }

    setVisible(v) {
        this.visible = v;
        this.container.isVisible = v;
    }

    setCharge(value) {
        this.charge = Math.max(0, Math.min(1, value));
    }

    update(dt) {
        // Smooth width interpolation
        const current = parseFloat(this.fill.width);
        const target = this.charge;
        const lerped = current + (target - current) * 0.15;
        this.fill.width = (lerped * 100).toFixed(1) + "%";

        // Pulse when > 85%
        if (this.charge > 0.85) {
            if (!this.pulseAnim) {
                this.startPulse();
            }
        } else {
            if (this.pulseAnim) {
                this.stopPulse();
            }
        }
    }

    startPulse() {
        this.pulseAnim = new BABYLON.Animation(
            "pulseAnim",
            "alpha",
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [
            { frame: 0, value: 0.9 },
            { frame: 15, value: 1.0 },
            { frame: 30, value: 0.9 }
        ];

        this.pulseAnim.setKeys(keys);
        this.frame.animations = [this.pulseAnim];

        this.game.scene.beginAnimation(this.frame, 0, 30, true);
    }

    stopPulse() {
        this.game.scene.stopAnimation(this.frame);
        this.frame.alpha = 0.9;
        this.pulseAnim = null;
    }

    draw() {
        // Babylon GUI draws automatically — no manual draw needed
    }
}
