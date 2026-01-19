export function createCourt(scene) {
  const court = {};

  // Floor (wood)
  const floor = BABYLON.MeshBuilder.CreateGround("floor", {
    width: 40,
    height: 24,
    subdivisions: 1
  }, scene);
  floor.position.y = 0;

  const floorMat = new BABYLON.StandardMaterial("floorMat", scene);
  floorMat.diffuseColor = new BABYLON.Color3(0.75, 0.55, 0.35);
  floorMat.specularColor = new BABYLON.Color3(0.4, 0.3, 0.2);
  floorMat.emissiveColor = new BABYLON.Color3(0.1, 0.07, 0.05);
  floor.material = floorMat;

  // Court lines
  const lineMat = new BABYLON.StandardMaterial("lineMat", scene);
  lineMat.emissiveColor = new BABYLON.Color3(1, 1, 1);

  function makeLine(name, from, to) {
    const line = BABYLON.MeshBuilder.CreateLines(name, { points: [from, to] }, scene);
    line.color = new BABYLON.Color3(1, 1, 1);
    line.alwaysSelectAsActiveMesh = true;
    return line;
  }

  const y = 0.01;
  makeLine("baselineL", new BABYLON.Vector3(-18, y, -10), new BABYLON.Vector3(18, y, -10));
  makeLine("baselineR", new BABYLON.Vector3(-18, y, 10), new BABYLON.Vector3(18, y, 10));
  makeLine("sidelineL", new BABYLON.Vector3(-18, y, -10), new BABYLON.Vector3(-18, y, 10));
  makeLine("sidelineR", new BABYLON.Vector3(18, y, -10), new BABYLON.Vector3(18, y, 10));
  makeLine("centerline", new BABYLON.Vector3(-18, y, 0), new BABYLON.Vector3(18, y, 0));

  // Net posts
  const postMat = new BABYLON.StandardMaterial("postMat", scene);
  postMat.diffuseColor = new BABYLON.Color3(0.85, 0.9, 0.95);
  postMat.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);

  const postL = BABYLON.MeshBuilder.CreateCylinder("postL", {
    height: 3.5,
    diameter: 0.2
  }, scene);
  postL.position = new BABYLON.Vector3(-8, 1.75, 0);
  postL.material = postMat;

  const postR = postL.clone("postR");
  postR.position.x = 8;

  // Net
  const net = BABYLON.MeshBuilder.CreatePlane("net", {
    width: 16,
    height: 2.4
  }, scene);
  net.position = new BABYLON.Vector3(0, 1.6, 0);
  net.rotation.y = Math.PI / 2;

  const netMat = new BABYLON.StandardMaterial("netMat", scene);
  netMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  netMat.alpha = 0.7;
  netMat.emissiveColor = new BABYLON.Color3(0.8, 0.9, 1);
  net.material = netMat;

  // Back wall
  const wall = BABYLON.MeshBuilder.CreateBox("wall", {
    width: 40,
    height: 10,
    depth: 0.5
  }, scene);
  wall.position = new BABYLON.Vector3(0, 5, 14);
  const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
  wallMat.diffuseColor = new BABYLON.Color3(0.1, 0.15, 0.22);
  wallMat.emissiveColor = new BABYLON.Color3(0.03, 0.05, 0.08);
  wall.material = wallMat;

  // Windows with sky
  const windowMat = new BABYLON.StandardMaterial("windowMat", scene);
  windowMat.emissiveColor = new BABYLON.Color3(0.4, 0.6, 1);
  windowMat.alpha = 0.9;

  const windowCount = 4;
  const spacing = 8;
  const startX = -((windowCount - 1) * spacing) / 2;
  for (let i = 0; i < windowCount; i++) {
    const win = BABYLON.MeshBuilder.CreatePlane("window" + i, {
      width: 5,
      height: 3
    }, scene);
    win.position = new BABYLON.Vector3(startX + i * spacing, 6, 13.76);
    win.material = windowMat;
  }

  // Soft ambient light from windows
  const glow = new BABYLON.SpotLight("windowGlow",
    new BABYLON.Vector3(0, 7, 13),
    new BABYLON.Vector3(0, -1, -0.4),
    Math.PI / 2.2,
    10,
    scene);
  glow.intensity = 1.2;
  glow.diffuse = new BABYLON.Color3(0.6, 0.7, 1);

  court.floor = floor;
  court.net = net;
  court.netHeight = 2.4;
  court.width = 36;
  court.depth = 20;

  return court;
}
