export function setupEffects(scene, player, court) {
  const glowLayer = new BABYLON.GlowLayer("glow", scene);
  glowLayer.intensity = 0.7;

  const aura = BABYLON.MeshBuilder.CreateTorus("overchargeAura", {
    diameter: 2.6,
    thickness: 0.15
  }, scene);
  aura.rotation.x = Math.PI / 2;
  aura.isPickable = false;

  const auraMat = new BABYLON.StandardMaterial("auraMat", scene);
  auraMat.emissiveColor = new BABYLON.Color3(0.8, 0.3, 1);
  auraMat.diffuseColor = new BABYLON.Color3(0.2, 0, 0.3);
  auraMat.alpha = 0.0;
  aura.material = auraMat;

  const particleSystem = new BABYLON.ParticleSystem("overchargeParticles", 2000, scene);
  particleSystem.particleTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/flare.png", scene);
  particleSystem.emitter = player.mesh;
  particleSystem.minEmitBox = new BABYLON.Vector3(-0.3, 0, -0.3);
  particleSystem.maxEmitBox = new BABYLON.Vector3(0.3, 1.5, 0.3);
  particleSystem.color1 = new BABYLON.Color4(0.9, 0.4, 1, 1);
  particleSystem.color2 = new BABYLON.Color4(0.4, 0.7, 1, 1);
  particleSystem.minSize = 0.1;
  particleSystem.maxSize = 0.3;
  particleSystem.minLifeTime = 0.2;
  particleSystem.maxLifeTime = 0.6;
  particleSystem.emitRate = 0;
  particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  particleSystem.gravity = new BABYLON.Vector3(0, 2, 0);
  particleSystem.direction1 = new BABYLON.Vector3(-1, 3, -1);
  particleSystem.direction2 = new BABYLON.Vector3(1, 4, 1);
  particleSystem.minAngularSpeed = -2;
  particleSystem.maxAngularSpeed = 2;
  particleSystem.minEmitPower = 1;
  particleSystem.maxEmitPower = 3;
  particleSystem.updateSpeed = 0.01;
  particleSystem.start();

  const shockwave = BABYLON.MeshBuilder.CreateDisc("shockwave", {
    radius: 0.5,
    tessellation: 48
  }, scene);
  shockwave.rotation.x = Math.PI / 2;
  shockwave.isPickable = false;
  const shockMat = new BABYLON.StandardMaterial("shockMat", scene);
  shockMat.emissiveColor = new BABYLON.Color3(1, 0.7, 1);
  shockMat.alpha = 0;
  shockwave.material = shockMat;

  const effects = {
    aura,
    auraMat,
    particleSystem,
    shockwave,
    shockMat,
    overchargeActive: false,
    overchargeLevel: 0,
    impactFlashTime: 0,
    impactFlashDuration: 0.2,
    impactPos: new BABYLON.Vector3(0, 0, 0)
  };

  return effects;
}

export function updateEffects(effects, dt, player, ball) {
  const p = player;

  const targetLevel = p.hasCharge ? p.approachStrength : 0;
  effects.overchargeLevel += (targetLevel - effects.overchargeLevel) * 6 * dt;

  const auraAlpha = effects.overchargeLevel * 0.9;
  effects.auraMat.alpha = auraAlpha;
  effects.aura.position = player.mesh.position.clone();
  effects.aura.position.y += 1;

  effects.particleSystem.emitRate = 400 * effects.overchargeLevel;

  if (effects.impactFlashTime > 0) {
    effects.impactFlashTime -= dt;
    const t = 1 - effects.impactFlashTime / effects.impactFlashDuration;
    const scale = 1 + t * 6;
    effects.shockwave.scaling = new BABYLON.Vector3(scale, 1, scale);
    effects.shockMat.alpha = Math.max(0, 1 - t);
    effects.shockwave.position = effects.impactPos.clone();
    effects.shockwave.position.y = 0.02;
  } else {
    effects.shockMat.alpha = 0;
  }
}

export function triggerOverchargeImpact(effects, pos) {
  effects.impactPos = pos.clone();
  effects.impactFlashTime = effects.impactFlashDuration;
  effects.shockwave.scaling = new BABYLON.Vector3(1, 1, 1);
  effects.shockMat.alpha = 1;
}
