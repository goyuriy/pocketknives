# Characters

## xbot.glb

**X Bot**, a character from [Mixamo](https://www.mixamo.com), with Mixamo's
`idle`, `walk` and `run` clips (plus a few extras the game ignores). This copy
comes from the three.js examples
([`examples/models/gltf/Xbot.glb`](https://github.com/mrdoob/three.js/blob/r160/examples/models/gltf/Xbot.glb), r160),
already converted to glTF.

Mixamo characters and animations are free to use in games, personal or
commercial, under Adobe's Mixamo terms. They may not be redistributed on their
own as a character or animation pack. Shipped inside the game, as here, is the
use the terms allow.

## Swapping in your own Mixamo exports

The game reads one `.glb` holding a Mixamo-rigged character and its clips. It
finds the clips by name (`idle`, `walk`, `run`, case-insensitive) and the arm
bones by Mixamo's names (`RightArm`, `RightForeArm`, `RightHand`, and the
`Left` ones, with any `mixamorig:` prefix).

1. On mixamo.com pick a character and download it as **FBX, T-pose, with skin**.
2. Download each animation for that character as **FBX, without skin**, with
   **In Place** ticked: Idle, Walking, Running (Mixamo's "Walking" and
   "Running" are good starting points).
3. In Blender: import the character FBX, then each animation FBX. Rename the
   actions `idle`, `walk` and `run`, push them onto the character's armature
   (NLA editor), delete the imported animation armatures, and export
   **glTF 2.0 (.glb)** with animations.
4. Save it here as `xbot.glb` (or change `CHARACTER_URL` in
   `src/stage/views/characterView.ts`).
5. Measure the new clips' ground speeds and update `CLIPS` in the same file,
   or the feet will slide. The numbers there came from how fast a planted foot
   slides back in each in-place clip.
