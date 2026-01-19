import { getProfile, CharacterRoster } from "./charactersAndProgression.js";

export function createPlayer(scene, side) {
  const profile = getProfile();
  const charId = profile?.selected_character || "recruit";
  const charData = CharacterRoster.find(c => c.id === charId);

  const stats = charData?.stats || {
    speed: 0.7,
    jump: 0.7,
    power: 0.7,
    block: 0.7
  };

  // Create mesh
  const mesh = BABYLON.MeshBuilder.CreateSphere("player", {
    diameter: 1.2
  }, scene);

  mesh.position = new BABYLON.Vector3(
    side === "left" ? -3 : 3,
    1,
    side === "left" ? -4 : 4
  );

  // Material
  const mat = new BABYLON.StandardMaterial("playerMat", scene);
  mat.diffuseColor = side === "left"
    ? new BABYLON.Color3(0.4, 0.8, 1.0)
    : new BABYLON.Color3(1.0, 0.6, 0.6);
  mat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  mesh.material = mat;

  // Stat-based scaling (optional visual cue)
  const scaleFactor = 0.9 + stats.jump * 0.2;
  mesh.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);

  // Outline for visibility
  mesh.renderOutline = true;
  mesh.outlineWidth = 0.04;
  mesh.outlineColor = side === "left"
    ? new BABYLON.Color3(0.6, 0.9, 1.0)
    : new BABYLON.Color3(1.0, 0.7, 0.7);

  return {
    mesh,
    side,
    stats
  };
}
