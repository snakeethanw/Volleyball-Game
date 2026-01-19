// ball.js
// Handles ball creation, physics, tilt effects, serves, and out-of-bounds logic.

export function createBall(scene, court) {
  const mesh = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: 0.6 }, scene);
  const mat = new BABYLON.StandardMaterial("ballMat", scene);
  mat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.6);
  mesh.material = mat;

  const ball = {
    mesh,
    velocity: new BABYLON.Vector3(0, 0, 0),
    gravity: -18,
    inPlay: false,
    isOut: false,
    backTiltRisk: false,
    overchargeTooHigh: false,
    lastPlayerHitX: 0,
    lastHitterSide: null,
    serveState: "idle", // idle | tossed
    serveTossHeight: 2.9,
    court
  };

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    updateBallPhysics(ball, dt);
  });

  return ball;
}

function updateBallPhysics(ball, dt) {
  if (!ball.inPlay && ball.serveState !== "tossed") return;

  // Apply gravity
  ball.velocity.y += ball.gravity * dt;

  // Integrate position
  ball.mesh.position.addInPlace(ball.velocity.scale(dt));

  // Serve toss: clamp to toss height
  if (ball.serveState === "tossed") {
    if (ball.mesh.position.y >= ball.serveTossHeight) {
      ball.mesh.position.y = ball.serveTossHeight;
      ball.velocity.y = 0;
    }
  }

  // Ground collision (simple)
  if (ball.mesh.position.y < 0.3) {
    ball.mesh.position.y = 0.3;
    ball.velocity.y *= -0.2;
  }

  // Out-of-bounds check (back line only for now)
  const court = ball.court;
  if (court && !ball.isOut) {
    if (ball.mesh.position.z > court.backLineZ || ball.mesh.position.z < court.frontLineZ) {
      ball.isOut = true;
    }
  }
}

export function updateBall(scene, ball, player, opponent, court) {
  // This function is kept for compatibility; core physics is in updateBallPhysics.
  // You can extend this to handle scoring, touches, etc.
}

export function serveBall(ball, server) {
  // Fixed, good toss height; timing is hitbox-only.
  ball.inPlay = false;
  ball.isOut = false;
  ball.backTiltRisk = false;
  ball.overchargeTooHigh = false;
  ball.serveState = "tossed";

  const basePos = server.mesh.position.clone();
  basePos.y = 1.2;
  basePos.z += server.side === "left" ? 1.5 : -1.5;

  ball.mesh.position.copyFrom(basePos);
  ball.velocity.set(0, 6, 0); // toss up to serveTossHeight
}

// Hit the ball with tilt and overcharge logic.
// tilt: { side: -1..1, forward: 0..1, back: 0..1 }
// isOvercharge: boolean
// contactHeight: number (ball.mesh.position.y at contact)
export function hitBall(ball, hitter, tilt, isOvercharge, contactHeight) {
  ball.inPlay = true;
  ball.serveState = "none";
  ball.lastPlayerHitX = hitter.mesh.position.x;
  ball.lastHitterSide = hitter.side;
  ball.backTiltRisk = false;
  ball.overchargeTooHigh = false;

  // Base forward direction (toward opponent side)
  const forwardDir = hitter.side === "left" ? 1 : -1;

  // Base speed
  let speedZ = 10;
  let speedY = 4;

  // Forward tilt: more downward arc
  if (tilt.forward > 0) {
    speedY -= 4 * tilt.forward;
    speedZ += 1.5 * tilt.forward;
  }

  // Back tilt: higher, farther, slower downward arc
  if (!isOvercharge && tilt.back > 0) {
    speedY += 2.5 * tilt.back;
    speedZ += 2.0 * tilt.back;
    ball.backTiltRisk = contactHeight > 3.2;
  }

  // Overcharge: strong downward force, normally ignores back tilt
  if (isOvercharge) {
    speedY -= 10; // strong downward
    speedZ += 1.5;

    // But if contact is WAY too high, even overcharge can go long
    if (contactHeight > 3.9) {
      speedY += 2.0;
      speedZ += 2.5;
      ball.overchargeTooHigh = true;
    }
  }

  // Side tilt: curve left/right and can "save" back-tilt risk
  let sideCurve = 4 * tilt.side; // horizontal component
  if (ball.backTiltRisk) {
    const curve = Math.abs(tilt.side);
    speedZ -= curve * 1.8; // reduce how far it travels
    if (curve > 0.6) {
      ball.backTiltRisk = false; // saved by side tilt
    }
  }

  ball.velocity.x = sideCurve;
  ball.velocity.z = forwardDir * speedZ;
  ball.velocity.y = speedY;
}
