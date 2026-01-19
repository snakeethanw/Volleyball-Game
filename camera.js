export function setupCamera(scene, canvas, court) {
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    BABYLON.Tools.ToRadians(65),
    26,
    new BABYLON.Vector3(0, 3, 0),
    scene
  );

  camera.lowerRadiusLimit = 18;
  camera.upperRadiusLimit = 40;
  camera.wheelPrecision = 40;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  return camera;
}
