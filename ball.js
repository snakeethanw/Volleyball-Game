import { awardMatchXP } from "./charactersAndProgression.js";

const GRAVITY = -18;

// =====================================================
//   CREATE BALL
// =====================================================
export function createBall(scene, court) {
  const mesh = BABYLON.MeshBuilder.CreateSphere("ball", {
    diameter: 1
  }, scene);

  mesh.position = new BABYLON.Vector3(0, 4, 0);

  const mat = new BABYLON.StandardMaterial("ballMat", scene);
  mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  mat.specularColor = new BABYLON.Color3(0.7, 0.7, 0.7);
  mat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  mesh.material = mat;

  return {
    mesh,
    velocity: new BABYLON.Vector3(0, 0, 0),
    inPlay: true
  };
}

// =====================================================
//   SERVE ANIMATION
// =====================================================
export function serveBall(ball, player) {
  // Position ball above player
  ball.mesh.position = player.mesh.position.add(new BABYLON.Vector3(0, 2, 0));

  // Launch toward opponent
  const direction = player.side === "left" ? 1 : -1;
  ball.velocity = new BABYLON.Vector3(0, 6, direction * 6);

  // Add spin
  ball.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
  ball.mesh.rotate(BABYLON.Axis.X, 0.3, BABYLON.Space.LOCAL);
  ball.mesh.rotate(BABYLON.Axis.Z, 0.2, BABYLON.Space.LOCAL);

  // Mark ball as in play
  ball.inPlay = true;
}

// =====================================================
//   UPDATE BALL PHYSICS
// =====================================================
export function updateBall(scene, ball, player, opponent, court) {
  const dt = scene.getEngine().getDeltaTime() / 1000;

  // Gravity
  ball.velocity.y += GRAVITY * dt;

  // Apply velocity
  ball.mesh.position.addInPlace(ball.velocity.scale(dt));

  const halfWidth = court.width / 2 - 1;
  const halfDepth = court.depth / 2 - 1;

  // =====================================================
  //   FLOOR COLLISION + XP AWARD
  // =====================================================
  if (ball.mesh.position.y <= 0.5) {
    ball.mesh.position.y = 0.5;

    if (ball.inPlay) {
      const side = ball.mesh.position.z < 0 ? -1 : 1;

      if (side === -1) {
        awardMatchXP(false); // player lost rally
      } else {
        awardMatchXP(true);  // player won rally
      }

      ball.inPlay = false;
    }

    ball.velocity.y *= -0.4;
    ball.velocity.z *= 0.8;
  }

  // =====================================================
  //   WALL COLLISIONS
  // =====================================================
  if (ball.mesh.position.x < -halfWidth) {
    ball.mesh.position.x = -halfWidth;
    ball.velocity.x *= -0.6;
  }
  if (ball.mesh.position.x > halfWidth) {
    ball.mesh.position.x = halfWidth;
    ball.velocity.x *= -0.6;
  }
  if (ball.mesh.position.z < -halfDepth) {
    ball.mesh.position.z = -halfDepth;
    ball.velocity.z *= -0.6;
  }
  if (ball.mesh.position.z > halfDepth) {
    ball.mesh.position.z = halfDepth;
    ball.velocity.z *= -0.6;
  }

  // =====================================================
  //   NET COLLISION
  // =====================================================
  const netZ = 0;
  const netHeight = court.netHeight;

  if (
    Math.abs(ball.mesh.position.z - netZ) < 0.2 &&
    ball.mesh.position.y < netHeight + 0.5
  ) {
    ball.mesh.position.z =
      ball.mesh.position.z < netZ ? netZ - 0.2 : netZ + 0.2;

    ball.velocity.z *= -0.5;
  }

  // =====================================================
  //   PLAYER COLLISIONS
  // =====================================================
  [player, opponent].forEach(p => {
    const diff = ball.mesh.position.subtract(p.mesh.position);
    const dist = diff.length();
    const radius = 1.2;

    if (dist < radius) {
      const n = diff.normalize();
      ball.mesh.position = p.mesh.position.add(n.scale(radius));
      ball.velocity = n.scale(10);
      ball.inPlay = true;
    }
  });
}

// =====================================================
//   EXPORTS
// =====================================================
export { createBall, updateBall, serveBall };
