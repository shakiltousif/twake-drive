import FS from "fs/promises";

/** Throws if this file is more recent than it's built counter-part. */
export const checkBuiltFileYoungerThanSource = async built => {
  //TODO: Doesnt work when build fails, rebuild touches it even if failed. Does work for
  // stuff watching the source file and running something before it compiled
  // intented use: await checkBuiltFileYoungerThanSource(__filename);

  const latestFromStat = ({ mtimeMs, ctimeMs, birthtimeMs }) =>
    Math.max(mtimeMs, Math.max(ctimeMs, birthtimeMs));
  const source = built.replace(/\/dist\//, "/src/").replace(/js$/, "ts");
  const builtDate = latestFromStat(await FS.stat(built));
  const sourceDate = latestFromStat(await FS.stat(source));
  if (sourceDate > builtDate) throw new Error(`Build result is out of date on ${source}`);
};
