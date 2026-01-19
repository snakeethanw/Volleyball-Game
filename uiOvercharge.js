// uiOvercharge.js
// Babylon.js GUI Overcharge Meter — hybrid esports bar

export class UIOvercharge {
    constructor(game) {
        this.game = game;

        this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UIOvercharge");

        this.container = new BABYLON.GUI.Rectangle("overchargeContainer");
        this.container.width = "40%";
        this.container.height = "40px";
        this.container.thickness = 0;
        this.container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.container.top = "-40px";
        this.ui.addControl(this.container);

        this.frame = new BABYLON.GUI.Rectangle("overchargeFrame");
        this.frame.width = 1;
        this.frame.height = 1;
        this.frame.thickness = 3;
        this.frame.color = "#00eaff";
        this.frame.cornerRadius = 12;
        this.frame.alpha = 0.9;
        this.container.addControl(this.frame);

        this.fill = new BABYLON.GUI.Rectangle("overchargeFill");
        this.fill.width = "0%";
        this.fill.height = 1;
        this.fill.thickness = 0;
        this.fill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.fill.cornerRadius = 12;

        const gradient = new BABYLON.GUI.LinearGradient(0, 0, 1, 0);
        gradient.addColorStop(0, "#ffe066");
        gradient.addColorStop(0.5, "#ff8c42");
        gradient.addColorStop(1, "#ff3b3b");
        this.fill.backgroundGradient = gradient;

        this.frame.addControl(this.fill);

        this.pulseAnim = null;
        this.flashAnim = null;
        this.charge = 0;
        this.visible = true;
    }

    setVisible(v) {
        this.visible = v;
        this.container.isVisible = v;
    }

    setCharge(value) {
        this.charge = Math.max(0, Math.min(1, value));
    }

    update(dt) {
        const current = parseFloat(this.fill.width);
        const target = this.charge;
        const lerped = current + (target - current) * 0.2;
        this.fill.width = (lerped * 100).toFixed(1) + "%";

        if (this.charge > 0.85) {
            if (!this.pulseAnim) this.startPulse();
        } else {
            if (this.pulseAnim) this.stopPulse();
        }

        if (this.charge >= 1 && !this.flashAnim) {
            this.startFlash();
        }
    }

    startPulse() {
        this.pulseAnim = new BABYLON.Animation(
            "overchargePulse",
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

    startFlash() {
        this.flashAnim = new BABYLON.Animation(
            "overchargeFlash",
            "scaleX",
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [
            { frame: 0, value: 1.0 },
            { frame: 10, value: 1.05 },
            { frame: 20, value: 1.0 }
        ];

        this.flashAnim.setKeys(keys);
        this.frame.animations.push(this.flashAnim);
        this.game.scene.beginAnimation(this.frame, 0, 20, true);
    }

    resetFlash() {
        if (this.flashAnim) {
            this.game.scene.stopAnimation(this.frame);
            this.frame.scaleX = 1.0;
            this.flashAnim = null;
        }
    }

    draw() {
        // Babylon GUI draws automatically
    }
}
