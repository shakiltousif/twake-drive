import util from "util";
import { exec } from "child_process";

export const execPromise = util.promisify(exec);

import OS from "os";
const openCommandForPlatform = () => {
  switch (OS.platform()) {
    case "darwin":
      return "open";
    case "win32":
      return "start";
    case "linux":
      return "xdg-open";
    default:
      throw new Error(`Platform ${OS.platform()} is not supported.`);
  }
};
const veryPoorManShellEscape = str => "'" + str.replace(/'/g, "'\"'\"'") + "'";

export const openWithSystemViewer = (file: string) =>
  execPromise([openCommandForPlatform(), veryPoorManShellEscape(file)].join(" "));

import { spawn as spawnWithCB } from "child_process";

export const spawn = (cmd: string, args: string[] = []) => {
  const reader = stream =>
    new Promise((resolve, reject) => {
      const bufs = [];
      let len = 0;
      stream.on("error", reject);
      stream.on("finish", () => {
        resolve(Buffer.concat(bufs, len).toString("utf-8"));
      });
      stream.on("data", data => {
        bufs.push(data);
        len += data.length;
      });
    });
  const process = spawnWithCB(cmd, args);
  const stdout = reader(process.stdout),
    stderr = reader(process.stderr);
  const processPromise = new Promise((resolve, reject) => {
    process.on("error", reject);
    process.on("close", resolve);
  });
  process.stdin.end();
  return Promise.all([processPromise, stdout, stderr]).then(([code, stdout, stderr]) => ({
    code,
    stdout,
    stderr,
  }));
};

export const spawnCheckingExitCode = (cmd: string, args: string[] = []) =>
  spawn(cmd, args).then(execResult => {
    if (execResult.code != 0)
      throw new Error(
        `Error running ${cmd} ${JSON.stringify(args)}: exit with ${execResult.code}. Output:\n${
          execResult.stdout
        }\n${execResult.stderr}`,
      );
    return execResult;
  });
