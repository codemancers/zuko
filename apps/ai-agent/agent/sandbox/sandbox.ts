import { defineSandbox } from "eve/sandbox";
import { createFlySpriteBackend } from "./fly-sprite.js";

/**
 * eve's per-session sandbox, backed by a Fly Sprite. eve owns the lifecycle
 * (provision on first use, resume from captured state, dispose) and exposes its
 * built-in sandbox tools (bash, read_file, write_file, glob, grep) to the model.
 */
export default defineSandbox({
  backend: createFlySpriteBackend(),
});
