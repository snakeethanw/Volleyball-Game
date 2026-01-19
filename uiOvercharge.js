// uiOvercharge.js
// Hybrid S1 + S4 Overcharge Meter with E1 angled ends
// Always visible during gameplay, hidden in menus

export class UIOvercharge {
    constructor(game) {
        this.game = game;

        // Charge state
        this.charge = 0;          // 0–1
        this.targetCharge = 0;    // smooth lerp target

        // Visibility
        this.visible = true;
        this.alpha = 1;           // fade animation

        // Animation helpers
        this.pulseTimer = 0;
        this.glowTimer = 0;
        this.shakeTimer = 0;

        // Layout
        this.widthRatio = 0.35;   // % of screen width
        this.height = 22;
        this.outlineWidth = 2;

        // Fade speeds
        this.fadeSpeed = 0.15;
    }

    // Called by main.js
    setCharge(value) {
        this.targetCharge = Math.max(0, Math.min(1, value));
    }

    // Called by main.js when entering/exiting menus
    setVisible(isVisible) {
        this.visible = isVisible;
    }

    update(dt) {
        // Smooth charge animation
        this.charge += (this.targetCharge - this.charge) * 0.12;

        // Fade animation
        const targetAlpha = this.visible ? 1 : 0;
        this.alpha += (targetAlpha - this.alpha) * this.fadeSpeed;

        // Pulse/glow timers
        if (this.charge > 0.8) this.pulseTimer += dt * 4;
        if (this.charge > 0.95) this.glowTimer += dt * 6;

        // Shake on full overcharge
        if (this.charge >= 1 && this.shakeTimer < 0.2) {
            this.shakeTimer += dt;
        } else if (this.charge < 1) {
            this.shakeTimer = 0;
        }
    }

    draw(ctx, canvas) {
        if (this.alpha <= 0.01) return;

        const barWidth = canvas.width * this.widthRatio;
        const barHeight = this.height;
        const x = (canvas.width - barWidth) / 2;
        const y = canvas.height - barHeight - 20;

        // Shake effect
        let shakeX = 0;
        if (this.shakeTimer > 0) {
            shakeX = Math.sin(this.shakeTimer * 40) * 2;
        }

        ctx.save();
        ctx.globalAlpha = this.alpha;

        // Outer neon outline
        ctx.strokeStyle = this.getOutlineColor();
        ctx.lineWidth = this.outlineWidth;
        this.drawAngledBar(ctx, x + shakeX, y, barWidth, barHeight, false);

        // Fill
        ctx.fillStyle = this.getFillGradient(ctx, x, y, barWidth, barHeight);
        this.drawAngledBar(ctx, x + shakeX, y, barWidth * this.charge, barHeight, true);

        // Pulse overlay
        if (this.charge > 0.8) {
            const pulse = (Math.sin(this.pulseTimer) + 1) * 0.15;
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
            this.drawAngledBar(ctx, x + shakeX, y, barWidth * this.charge, barHeight, true);
        }

        // Glow flicker
        if (this.charge > 0.95) {
            const flicker = (Math.sin(this.glowTimer * 3) + 1) * 0.1;
            ctx.strokeStyle = `rgba(255, 80, 80, ${flicker})`;
            ctx.lineWidth = this.outlineWidth + 1;
            this.drawAngledBar(ctx, x + shakeX, y, barWidth, barHeight, false);
        }

        // Percentage text
        ctx.font = "14px 'Orbitron', sans-serif";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Math.round(this.charge * 100) + "%", x + barWidth / 2 + shakeX, y + barHeight / 2);

        ctx.restore();
    }

    // Draws the angled bar shape (E1 soft angled ends)
    drawAngledBar(ctx, x, y, w, h, fill) {
        const angle = 10; // px offset for soft angle

        ctx.beginPath();
        ctx.moveTo(x + angle, y);
        ctx.lineTo(x + w - angle, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();

        if (fill) ctx.fill();
        else ctx.stroke();
    }

    // Gradient fill based on charge
    getFillGradient(ctx, x, y, w, h) {
        const grad = ctx.createLinearGradient(x, y, x + w, y);

        if (this.charge < 0.3) {
            grad.addColorStop(0, "#ffe066");
            grad.addColorStop(1, "#ffcc33");
        } else if (this.charge < 0.7) {
            grad.addColorStop(0, "#ffb347");
            grad.addColorStop(1, "#ff8c00");
        } else {
            grad.addColorStop(0, "#ff6b6b");
            grad.addColorStop(1, "#ff1e1e");
        }

        return grad;
    }

    // Neon outline color
    getOutlineColor() {
        const intensity = 0.4 + this.charge * 0.6;
        return `rgba(255, 80, 80, ${intensity})`;
    }
}
