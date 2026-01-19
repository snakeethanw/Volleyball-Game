export function createScoreboard(scene) {
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("scoreUI");

  const leftScore = new BABYLON.GUI.TextBlock();
  leftScore.text = "0";
  leftScore.color = "white";
  leftScore.fontSize = 64;
  leftScore.left = "-200px";
  leftScore.top = "20px";
  ui.addControl(leftScore);

  const rightScore = new BABYLON.GUI.TextBlock();
  rightScore.text = "0";
  rightScore.color = "white";
  rightScore.fontSize = 64;
  rightScore.left = "200px";
  rightScore.top = "20px";
  ui.addControl(rightScore);

  return {
    update(left, right) {
      leftScore.text = left.toString();
      rightScore.text = right.toString();
    }
  };
}
