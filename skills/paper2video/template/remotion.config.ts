// All configuration options: https://remotion.dev/docs/config
// (When rendering through the Node.js APIs this file does not apply; pass the options directly.)
import { Config } from "@remotion/cli/config";

// Temp files (Remotion's webpack bundle is a 50+ MB copy of the project) go to $PAPER_VIDEO_TMPDIR when it is set,
// e.g. a folder on the external drive that holds the workspace (some launchers reset TMPDIR itself).
if (process.env.PAPER_VIDEO_TMPDIR) process.env.TMPDIR = process.env.PAPER_VIDEO_TMPDIR;

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
