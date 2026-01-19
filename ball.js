import { awardMatchXP } from "./charactersAndProgression.js";

const GRAVITY = -18;

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

  const ball = {
    mesh,
    velocity: new BABYLON.Vector3(0, 0, 0),
    lastSide: 0,   // -1 = your side, 1 = opponent side
    inPlay: true
  };

  return ball;
}

export function updateBall(scene, ball, player, opponent, court) {
  const dt = scene.getEngine().getDeltaTime() / 1000;

  ball.velocity.y += GRAVITY * dt;
  ball.mesh.position.addInPlace(ball.velocity.scale(dt));

  const halfWidth = court.width / 2 - 1;
  const halfDepth = court.depth / 2 - 1;

  if (ball.mesh.position.y <= 0.5) {
    ball.mesh.position.y = 0.5;

    const side = ball.mesh.position.z < 0 ? -1 : 1;

    if (ball.inPlay) {
      if (side === -1) {
        awardMatchXP(false);
      } else {
        awardMatchXP(true);
      }
      ball.inPlay = false;
    }

    ball.velocity.y *= -0.4;
    ball.velocity.z *= 0.8;
  }

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

  const netZ = 0;
  const netHeight = court.netHeight;
  if (
    Math.abs(ball.mesh.position.z - netZ) < 0.2 &&
    ball.mesh.position.y < netHeight + 0.5
  ) {
    ball.mesh.position.z = ball.mesh.position.z < netZ ? netZ - 0.2 : netZ + 0.2;
    ball.velocity.z *= -0.5;
  }

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
