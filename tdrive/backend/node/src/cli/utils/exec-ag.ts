import { spawnCheckingExitCode } from "../../utils/exec";

const runSearch = async (regex, folder, ignoreFolder?, useNull: boolean = false) => {
  // const result = await spawnCheckingExitCode("ag", ["--count", "--case-sensitive", "--print0", "--fixed-strings", label, folder]);
  // --ignore-dir not taken into acount ....
  const result = await spawnCheckingExitCode("ag", [
    ...(useNull ? ["--print0"] : []),
    ...regex,
    folder,
  ]);
  if (result.code !== 0) {
    if (result.stderr === "") return [];
    throw new Error(`Unexpected result from ag: ${result.code}: ${result.stderr}${result.stdout}`);
  }
  return (result.stdout as string)
    .split(useNull ? "\x00" : "\n")
    .filter(x => x && (!ignoreFolder || !x.startsWith(ignoreFolder)));
};

/** Try to run `ag`, returns its version string, false if it wasn't found, and throws for any other error */
export const getAgVersion = async () => {
  try {
    const result = await spawnCheckingExitCode("ag", ["--version"]);
    return result.stdout;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
};

// Poor man's regexp maker... don't put any symbols in label names ok...
export const runSearchLiteral = async (label, folder, ignoreFolder?) =>
  (
    await runSearch(
      ["--count", "--case-sensitive", `\\b${label.replace(/\./g, "\\.")}\\b`],
      folder,
      ignoreFolder,
      true,
    )
  ).map(line => line.split(":")[0]);

export const runRegexp = async (regex: RegExp, folder: string, ignoreFolder?: string) =>
  (
    await runSearch(
      [regex.ignoreCase ? "--ignore-case" : "--case-sensitive", regex.source],
      folder,
      ignoreFolder,
    )
  )
    .map(row => {
      const match = /^([^:]+):([^:]+):\s*(.*)$/.exec(row);
      if (!match) {
        console.error(`Error matching row: ${JSON.stringify(row)}`);
        return null;
      }
      const [_, file, _lineNumber, line] = match;
      const innerMatch = regex.exec(line);
      if (!innerMatch) {
        console.error(`Error matching row for inner: ${JSON.stringify(row)}`);
        return null;
      }
      return { file, line, match: innerMatch.groups?.result || innerMatch[0] };
    })
    .filter(x => x);
