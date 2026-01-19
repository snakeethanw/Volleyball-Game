import { CharacterRoster } from "./charactersAndProgression.js";

const GRAVITY = -18;
const MOVE_SPEED = 10;
const JUMP_FORCE = 11;

function hasChargePowerForId(id) {
  const c = CharacterRoster.find(ch => ch.id === id);
  if (!c) return false;
  const p = c.stats?.power;
  return typeof p === "object" && !!p.charge;
}

export function createPlayers(scene, playerChar, oppChar, court) {
  function makePlayerMesh(name, color, x, side, charData) {
    const body = BABYLON.MeshBuilder.CreateBox(name, {
      width: 1,
      height: 2,
      depth: 0.6
    }, scene);
    body.position = new BABYLON.Vector3(x, 1, side === "left" ? -4 : 4);

    const mat = new BABYLON.StandardMaterial(name + "Mat", scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.3);
    mat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    body.material = mat;

    const head = BABYLON.MeshBuilder.CreateSphere(name + "Head", {
      diameter: 0.9
    }, scene);
    head.position = body.position.add(new BABYLON.Vector3(0, 1.4, 0));
    head.parent = body;

    const shadow = BABYLON.MeshBuilder.CreateDisc(name + "Shadow", {
      radius: 0.8,
      tessellation: 24
    }, scene);
    shadow.rotation.x = Math.PI / 2;
    shadow.position = new BABYLON.Vector3(body.position.x, 0.01, body.position.z);
    const shadowMat = new BABYLON.StandardMaterial(name + "ShadowMat", scene);
    shadowMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    shadowMat.alpha = 0.4;
    shadow.material = shadowMat;

    return {
      mesh: body,
      head,
      shadow,
      side,
      vy: 0,
      onGround: true,
      approachDistance: 0,
      approachStrength: 0,
      lastX: body.position.x,
      lockedApproach: 0,
      hasCharge: hasChargePowerForId(charData.id),
      charId: charData.id
    };
  }

  const player = makePlayerMesh(
    "player",
    new BABYLON.Color3(0.3, 0.6, 1),
    -6,
    "left",
    playerChar
  );

  const opponent = makePlayerMesh(
    "opponent",
    new BABYLON.Color3(1, 0.4, 0.4),
    6,
    "right",
    oppChar
  );

  return { player, opponent };
}

function updateApproach(p, dt) {
  if (!p.hasCharge) return;

  const dx = p.mesh.position.x - p.lastX;
  const movingTowardNet =
    (p.side === "left" && dx > 0) ||
    (p.side === "right" && dx < 0);

  if (movingTowardNet && p.onGround) {
    p.approachDistance += Math.abs(dx);
  } else {
    p.approachDistance *= 0.9;
  }

  p.approachDistance = Math.min(p.approachDistance, 12);
  p.approachStrength = p.approachDistance / 12;
  p.lastX = p.mesh.position.x;
}

export function updatePlayers(scene, player, opponent, court, input, ball, onOverchargeSpike) {
  const dt = scene.getEngine().getDeltaTime() / 1000;

  function updateOne(p, isPlayer) {
    let move = 0;
    if (isPlayer) {
      if (input.left) move -= 1;
      if (input.right) move += 1;
    } else {
      // Simple AI: move toward ball x
      if (ball.mesh.position.x < p.mesh.position.x - 1) move -= 0.6;
      else if (ball.mesh.position.x > p.mesh.position.x + 1) move += 0.6;
    }

    p.mesh.position.x += move * MOVE_SPEED * dt;

    const halfWidth = court.width / 2 - 2;
    if (p.side === "left") {
      p.mesh.position.x = BABYLON.Scalar.Clamp(p.mesh.position.x, -halfWidth, -1.2);
    } else {
      p.mesh.position.x = BABYLON.Scalar.Clamp(p.mesh.position.x, 1.2, halfWidth);
    }

    if (isPlayer && input.jump && p.onGround) {
      p.vy = JUMP_FORCE;
      p.onGround = false;
      if (p.hasCharge) {
        p.lockedApproach = p.approachStrength;
      }
    }

    p.vy += GRAVITY * dt;
    p.mesh.position.y += p.vy * dt;

    if (p.mesh.position.y <= 1) {
      p.mesh.position.y = 1;
      p.vy = 0;
      p.onGround = true;
    }

    p.shadow.position.x = p.mesh.position.x;
    p.shadow.position.z = p.mesh.position.z;

    updateApproach(p, dt);

    if (isPlayer && input.spike && !p.onGround) {
      const dx = Math.abs(ball.mesh.position.x - p.mesh.position.x);
      const dz = Math.abs(ball.mesh.position.z - p.mesh.position.z);
      const dy = p.mesh.position.y - ball.mesh.position.y;
      if (dx < 2 && dz < 2 && dy > 0 && dy < 3) {
        const basePower = 16;
        const overcharge = p.hasCharge ? p.lockedApproach : 0;
        const power = basePower * (1 + overcharge * 0.8);

        const dirZ = p.side === "left" ? 1 : -1;
        ball.velocity.x = 0;
        ball.velocity.y = -4;
        ball.velocity.z = dirZ * power;

        if (p.hasCharge && overcharge > 0.9 && onOverchargeSpike) {
          onOverchargeSpike(ball.mesh.position.clone());
        }
      }
    }
  }

  updateOne(player, true);
  updateOne(opponent, false);
}
