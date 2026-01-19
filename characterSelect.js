import { CharacterRoster, selectCharacter } from "./charactersAndProgression.js";

export function createCharacterSelect(scene, onSelect) {
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("charSelectUI");

  const title = new BABYLON.GUI.TextBlock();
  title.text = "SELECT YOUR CHARACTER";
  title.color = "white";
  title.fontSize = 48;
  title.top = "-300px";
  ui.addControl(title);

  const grid = new BABYLON.GUI.Grid();
  grid.addColumnDefinition(0.33);
  grid.addColumnDefinition(0.33);
  grid.addColumnDefinition(0.33);
  grid.addRowDefinition(0.33);
  grid.addRowDefinition(0.33);
  grid.addRowDefinition(0.33);
  grid.width = "90%";
  grid.height = "70%";
  grid.top = "50px";
  ui.addControl(grid);

  CharacterRoster.forEach((char, i) => {
    const btn = BABYLON.GUI.Button.CreateSimpleButton(char.id, char.name);
    btn.height = "120px";
    btn.color = "white";
    btn.background = "#333a4a";
    btn.cornerRadius = 12;

    const row = Math.floor(i / 3);
    const col = i % 3;
    grid.addControl(btn, row, col);

    btn.onPointerUpObservable.add(async () => {
      await selectCharacter(char.id);
      ui.dispose();
      onSelect();
    });
  });

  // Slide-in animation
  scene.onBeforeRenderObservable.add(() => {
    if (title.top < "-100px") title.top = (parseFloat(title.top) + 4) + "px";
  });
}
