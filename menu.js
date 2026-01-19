export function createMainMenu(scene, engine, startCallback) {
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("menuUI");

  const title = new BABYLON.GUI.TextBlock();
  title.text = "VOLLEYBALL 3D";
  title.color = "white";
  title.fontSize = 72;
  title.top = "-200px";
  title.alpha = 0;
  ui.addControl(title);

  const playBtn = BABYLON.GUI.Button.CreateSimpleButton("playBtn", "PLAY");
  playBtn.width = "300px";
  playBtn.height = "80px";
  playBtn.color = "white";
  playBtn.background = "#4aa3ff";
  playBtn.cornerRadius = 12;
  playBtn.top = "100px";
  playBtn.alpha = 0;
  ui.addControl(playBtn);

  // Fade-in animation
  scene.onBeforeRenderObservable.add(() => {
    if (title.alpha < 1) title.alpha += 0.01;
    if (playBtn.alpha < 1) playBtn.alpha += 0.01;
    if (title.top < "-100px") title.top = (parseFloat(title.top) + 2) + "px";
  });

  playBtn.onPointerUpObservable.add(() => {
    ui.dispose();
    startCallback();
  });
}
