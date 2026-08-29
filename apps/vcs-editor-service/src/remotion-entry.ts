import { registerRoot } from "remotion";
import { RemotionRoot } from "@vcs/remotion";

// Entry point the @remotion/bundler compiles for server-side rendering.
// Registers the shared composition so the headless renderer and the dashboard
// preview stay byte-for-byte identical.
registerRoot(RemotionRoot);
