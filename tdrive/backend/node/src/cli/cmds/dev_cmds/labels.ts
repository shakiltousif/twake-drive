import yargs from "yargs";

import parseYargsCommaSeparatedStringArray from "../../utils/yargs-comma-array";
import { NonPlatformCommandYargsBuilder } from "../../utils/non-plaform-command-yargs-builder";

import { startProgress, box, printTable } from "../../utils/text";

import FS from "fs/promises";
import Path from "path";

import { getAgVersion, runRegexp, runSearchLiteral } from "../../utils/exec-ag";

import { checkBuiltFileYoungerThanSource } from "../../utils/check-built-younger-than-source";

function upsertMapOfContainers<TK, TV>(
  map: Map<TK, TV>,
  key: TK,
  ctor: (TK) => TV,
  add: (TV) => void,
) {
  let container = map.get(key);
  if (container === undefined) map.set(key, (container = ctor(key)));
  add(container);
  return container;
}
const upsertMapOfSets = <TK, TV>(map: Map<TK, Set<TV>>, key: TK, value: TV) =>
  upsertMapOfContainers(
    map,
    key,
    () => new Set(),
    set => set.add(value),
  );
const upsertMapOfArrays = <TK, TV>(map: Map<TK, TV[]>, key: TK, value: TV) =>
  upsertMapOfContainers(
    map,
    key,
    () => [],
    array => array.push(value),
  );
const upsertMapValue = <TK, TV>(map: Map<TK, TV>, key: TK, update: (value: TV | undefined) => TV) =>
  map.set(key, update(map.get(key)));
const upsertMapOfCounts = <TK>(map: Map<TK, number>, key: TK) =>
  upsertMapValue(map, key, count => (count || 0) + 1);
const mapOfCountsEntriesOrderedByCount = <TK>(map: Map<TK, number>) =>
  [...map.entries()].sort(([_a, a], [_b, b]) => b - a);
const mapOfCountsKeysOrderedByCount = <TK>(map: Map<TK, number>) =>
  mapOfCountsEntriesOrderedByCount(map).map(([key]) => key);

const REPO_ROOT = Path.join(__dirname, ...new Array(6 + 1).fill(".."));
const FRONT_ROOT = Path.join(REPO_ROOT, "tdrive/frontend");
const FRONT_LOCALES = Path.join(FRONT_ROOT, "public/locales");
const BACK_ROOT = Path.join(REPO_ROOT, "tdrive/backend/node");
const BACK_LOCALES = Path.join(BACK_ROOT, "locales");

/** Represents a single locale json file of labels -> translations */
class LabelFile {
  private constructor(
    private readonly lang: string,
    private readonly filename: string,
    private readonly data: { [key: string]: string },
  ) {}
  static async load(lang: string, filename: string) {
    const data = JSON.parse(await FS.readFile(filename, "utf-8"));
    return new LabelFile(lang, filename, data);
  }
  private get keys() {
    return Object.keys(this.data);
  }
  get count() {
    return this.keys.length;
  }
  get labels() {
    return this.keys.sort();
  }
  translate(label: string): string | undefined {
    return this.data[label];
  }
  toString() {
    return `<${this.count} ${this.lang} labels from ${this.filename}>`;
  }
}

/** Represents a set of json files, one per language, and a project root */
class LabelRepository {
  private constructor(
    private readonly projectPath: string,
    private readonly localesPath: string,
    private readonly langs: { [key: string]: LabelFile },
  ) {}
  static async load(project: "front" | "back", filterLanguages?: string[]) {
    const [projectPath, localesPath] =
      project == "front" ? [FRONT_ROOT, FRONT_LOCALES] : [BACK_ROOT, BACK_LOCALES];
    const files = (await FS.readdir(localesPath, { withFileTypes: true })).filter(
      ent => ent.isFile() && ent.name.match(/\.json$/i),
    );
    const result = {};
    for (const ent of files) {
      const lang = Path.basename(ent.name, ".json");
      if (filterLanguages && filterLanguages.indexOf(lang.toLowerCase()) < 0) continue;
      const filename = Path.join((ent as unknown as { path: string }).path, ent.name);
      result[lang] = await LabelFile.load(lang, filename);
    }
    if (Object.keys(result).length === 0)
      throw new Error(
        `No locales found in ${localesPath}.${
          filterLanguages ? " Check language filter argument." : ""
        }`,
      );

    return new LabelRepository(projectPath, localesPath, result);
  }

  get languages() {
    return Object.keys(this.langs).sort();
  }
  get languagesByCount() {
    return this.languages
      .map(lang => [lang, this.langs[lang].count])
      .sort(([_a, a]: [string, number], [_b, b]: [string, number]) => b - a);
  }
  translate(label, lang) {
    return this.langs[lang].translate(label);
  }
  private __indexedLabels?: Map<string, Set<string>>;
  /** Returns translation keys to sets of the languages knowing them */
  get indexedLabels() {
    if (this.__indexedLabels) return this.__indexedLabels;
    const keys = new Map<string, Set<string>>();
    for (const lang of this.languages)
      for (const label of this.langs[lang].labels) upsertMapOfSets(keys, label, lang);
    return (this.__indexedLabels = keys);
  }

  /** Return labels that are in at least one locale file and are not in all locale files */
  indexedLabelsThatAreInOneButNotEveryLanguage(includeAnyway?: (label: string) => boolean) {
    const labels = this.indexedLabels;
    const count = this.languages.length;
    const result = new Map<string, Set<string>>();
    for (const [label, set] of labels.entries())
      if (set.size != count || (includeAnyway && includeAnyway(label))) result.set(label, set);
    return result;
  }

  private __findLabelsInSource?: Map<string, string[]>;
  /** This is a very simple heuristic, it won't catch most labels actually. Returns key to list of files. */
  async findUnkownLabelsInSource(includeKnown: boolean = false): Promise<Map<string, string[]>> {
    if (this.__findLabelsInSource) return this.__findLabelsInSource;
    const matches = await runRegexp(
      /'(?<result>[a-z_-]+\.[a-z_-]+\.[a-z_.-]+)'/i,
      FRONT_ROOT,
      FRONT_LOCALES,
    );
    const labelsToFiles = new Map<string, string[]>();
    matches.forEach(({ file, match }) => {
      if (!includeKnown && this.indexedLabels.has(match)) return;
      const files = labelsToFiles.get(match);
      if (files) files.push(file);
      else labelsToFiles.set(match, [file]);
    });
    return (this.__findLabelsInSource = labelsToFiles);
  }

  private __getUnusedLabels?: Map<string, Set<string>>;
  /** Search each label in the source code and return those with no matches and the languages they exist in */
  async getUnusedLabels() {
    if (this.__getUnusedLabels) return this.__getUnusedLabels;
    const logger = startProgress("Searching source for label ");
    const unusedKeys = new Map<string, Set<string>>();
    const indexed = this.indexedLabels;
    let keyIndex = 0;
    for (const [label, languages] of indexed.entries()) {
      logger(`${(keyIndex++ + "").padStart(3)} / ${indexed.size}: ${label}`);
      const found = !!(await runSearchLiteral(label, this.projectPath, this.localesPath)).length;
      if (!found) unusedKeys.set(label, languages);
    }
    logger(`- Found ${unusedKeys.size} unused keys`, true);
    return (this.__getUnusedLabels = unusedKeys);
  }
  /** Return all the translation of the given label. Keys are languages the label existed in. */
  getTranslationsOf(label): { [language: string]: string } {
    const result = {};
    for (const lang of this.languages) {
      const translation = this.translate(label, lang);
      if (translation) result[lang] = translation;
    }
    return result;
  }
  /** Return every label that has translations with identical values.
   * The values in the map are arrays of the languages that are identical, themselves in an array
   */
  getRepeatedTranslation(): Map<string, string[][]> {
    const result = new Map<string, string[][]>();
    for (const [label, languages] of this.indexedLabels.entries()) {
      const valuesToLang = new Map<string, Set<string>>();
      languages.forEach(lang => upsertMapOfSets(valuesToLang, this.translate(label, lang), lang));
      for (const [_text, languages] of valuesToLang.entries())
        if (languages.size > 1) upsertMapOfArrays(result, label, [...languages]);
    }
    return result;
  }
  makeTableOfIncompleteLabels(
    unusedLabels: Map<string, Set<string>> | undefined,
    unknownFromSource: Map<string, string[]> | undefined,
    previewIdenticalMaxLength: number,
    forceColumns?: string[],
    showMissingInsteadOfPresent?: boolean,
  ): string {
    const table = [];
    let columns = ["label"];

    if (unusedLabels?.size) columns.push("unused");
    if (unknownFromSource?.size) columns.push("src");
    const columnsToLeaveIntact = columns.length;

    const repeatedLabels = this.getRepeatedTranslation();
    const markRowRepetitions = (row, label) => {
      const repeatedLanguagesSet = repeatedLabels.get(label);
      if (repeatedLanguagesSet?.length) {
        let repetitionIndex = 0;
        for (const languages of repeatedLanguagesSet) {
          const text = this.translate(label, languages[0]);
          const indicator =
            text.length < previewIdenticalMaxLength
              ? JSON.stringify(text)
              : `=${repetitionIndex ? repetitionIndex : "="}`;
          repetitionIndex++;
          for (const language of languages) row[language] = indicator;
        }
      }
    };
    const seenLanguages = new Map<string, number>();
    const mark = "✔";
    const labels = this.indexedLabelsThatAreInOneButNotEveryLanguage(
      label => repeatedLabels.has(label) || unusedLabels?.has(label),
    );
    for (const [label, set] of labels) {
      const row = { label };
      for (const lang of set) {
        row[lang] = mark;
        upsertMapOfCounts(seenLanguages, lang);
      }
      if (unusedLabels?.has(label)) row["unused"] = mark;
      markRowRepetitions(row, label);
      table.push(row);
    }
    if (unknownFromSource)
      for (const label of unknownFromSource.keys()) table.push({ label, src: mark });

    columns = columns.concat(mapOfCountsKeysOrderedByCount(seenLanguages));
    if (forceColumns)
      for (const col of forceColumns) if (columns.indexOf(col) < 0) columns.push(col);
    return printTable(
      table,
      columns,
      false,
      true,
      showMissingInsteadOfPresent
        ? (cell, x, _y) =>
            x < columnsToLeaveIntact ? cell : cell === mark ? "" : cell == null ? "?" : cell
        : undefined,
    );
  }
}

async function printReport(component: "back" | "front", options: LabelsArguments) {
  let title = `Report for ${component} labels`;
  if (options.languages?.length) title += ` in ${options.languages.sort().join("+")}`;
  if (options.skipSourceSearch) title += " (without source code searches)";
  console.log(box(title));
  const repo = await LabelRepository.load(component, options.languages);
  for (const lang of options.languages || [])
    if (repo.languages.indexOf(lang) < 0)
      throw new Error(`Language '${lang}' was not found in locale files`);
  if (!options.languages) console.error(`Loaded languages: ${repo.languages.join(" ")}`);
  const labelsFromSource = options.skipSourceSearch
    ? undefined
    : await repo.findUnkownLabelsInSource();
  const unusedLabels = options.skipSourceSearch ? undefined : await repo.getUnusedLabels();
  console.log(
    repo.makeTableOfIncompleteLabels(
      unusedLabels,
      labelsFromSource,
      options.previewIdenticalMaxLength,
      options.languages,
      options.showMissingInsteadOfPresent,
    ),
  );
}

interface LabelsArguments {
  skipSourceSearch: boolean;
  languages?: string[];
  showMissingInsteadOfPresent: boolean;
  previewIdenticalMaxLength: number;
}
const ScanGroup = "Scan options";
const command: yargs.CommandModule<unknown, unknown> = {
  command: "labels",
  describe: `
    Load the locale json files, and optionally scan the source code, and
    print a report listing labels that are incomplete (not in all the
    translations loaded, or not in the source code).
    `.trim(),
  builder: {
    ...NonPlatformCommandYargsBuilder,
    skipSourceSearch: {
      type: "boolean",
      alias: "s",
      describe: "Skip using ag to scan source code for missing labels",
      default: false,
      group: ScanGroup,
    },
    languages: {
      type: "string",
      array: true,
      alias: "l",
      description: "Comma separated languages to consider, all others will be ignored",
      group: ScanGroup,
    },
    showMissingInsteadOfPresent: {
      type: "boolean",
      alias: "i",
      default: false,
      description: "If set show '?' on absent translations rather than ticks on present ones.",
    },
    previewIdenticalMaxLength: {
      type: "number",
      alias: "p",
      default: 10,
      description: "When displaying identical translations, put them inline if shorter than this",
    },
  },
  handler: async argv => {
    try {
      await checkBuiltFileYoungerThanSource(__filename);
      const args = argv as unknown as LabelsArguments;
      args.languages = parseYargsCommaSeparatedStringArray(args.languages).map(x =>
        x.toLowerCase(),
      );
      if (!args.languages?.length) args.languages = null;
      if (!args.skipSourceSearch) {
        const agVersion = !args.skipSourceSearch && (await getAgVersion());
        if (agVersion === false && !args.skipSourceSearch)
          console.warn(
            "Warning: command 'ag' not found, please install https://github.com/ggreer/the_silver_searcher . Source code searches disabled.",
          );
        args.skipSourceSearch = !agVersion;
      }

      if (args.languages?.length === 1 && args.skipSourceSearch)
        throw new Error("Only one language selected and source scan disabled - nothing to do.");

      await printReport("front", args);
      // Back doesn't really do translations
      // await printReport("back", args);
    } catch (e) {
      console.error(e.stack || e);
      process.exit(1);
    }
  },
};
export default command;
