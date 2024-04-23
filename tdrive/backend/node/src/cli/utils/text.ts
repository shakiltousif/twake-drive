import { inspect } from "util";

/** Similar to the arguments of `console.log` and friends, but returns a stri */
const logToStr = (...stuff: any): string =>
  stuff.map((x: any) => (typeof x == "string" ? x : inspect(x))).join(" ");

const wrap = (text: string, left: string, right = left) => left + text + right;

export function box(line: string): string {
  return [
    wrap("".padEnd(line.length + 2, "─"), "┌", "┐"),
    wrap(wrap(line, " "), "│"),
    wrap("".padEnd(line.length + 2, "─"), "└", "┘"),
  ].join("\n");
}

/** make a string filestable representation of provided data */
export function printTable(
  data: any[][],
  cols: string[],
  withRowNumbers = true,
  withCountRow = true,
  cellMapper?: (cell: any, col: number, row: number) => string,
) {
  if (withRowNumbers) {
    cols = ["#"].concat(cols);
    const maxWidth = (data.length + "").length;
    data = data.map((obj, index) => ({ ...obj, "#": index.toString().padStart(maxWidth) }));
  }
  const strData = [cols].concat(
    data.map((obj, y) =>
      cols.map((col, x) =>
        cellMapper
          ? cellMapper(obj[col], x - (withRowNumbers ? 1 : 0), y) ?? ""
          : obj[col] == null
          ? ""
          : "" + obj[col],
      ),
    ),
  );
  const colWidths = cols.map((_, x) =>
    strData.reduce((acc, row) => Math.max(acc, row[x].length), 0),
  );
  const asciiArtRow = (l, f, m, r) => wrap(colWidths.map(w => "".padEnd(w + 2, f)).join(m), l, r);
  const output = [];

  output.push(asciiArtRow("┌", "─", "┬", "┐"));
  strData.forEach((row, y) => {
    output.push(wrap(row.map((cell, x) => wrap(cell.padEnd(colWidths[x]), " ")).join("│"), "│"));
    if (y === 0 && strData.length > 1) output.push(asciiArtRow("├", "─", "┼", "┤"));
  });
  if (withCountRow) {
    output.push(asciiArtRow("├", "─", "┴", "┤"));
    const count = ` ${strData.length - 1} row${strData.length == 2 ? "" : "s"} `;
    output.push(
      wrap(
        count.padStart(colWidths.reduce((acc, w) => acc + w + 2, 0) + colWidths.length - 1),
        "│",
      ),
    );
    output.push(asciiArtRow("└", "─", "─", "┘"));
  } else output.push(asciiArtRow("└", "─", "┴", "┘"));
  return output.join("\n");
}

/** Show progress on the same line, until a \n ends the line */
export function startProgress(prefix: string) {
  let lastLen = 0;
  return (text: string, leave: boolean = false) => {
    if (lastLen) process.stderr.write("\r" + new Array(lastLen + 1).join(" "));
    process.stderr.write("\r" + prefix + text + (leave ? "\n" : "\r"));
    lastLen = leave || text.endsWith("\n") ? 0 : prefix.length + text.length;
  };
}

export class IndentedPrinter {
  static DefaultIndent = "    ";
  private readonly indents: string[] = [];
  private readonly lines: string[] = [];
  private depth = 0;
  toString() {
    return this.lines.join("\n");
  }
  private pushStr(str: string) {
    str
      .split("\n")
      .forEach(str =>
        this.lines.push(this.indents.join("") + str.replace(/\n/g, "\n" + this.indents.join(""))),
      );
  }
  push(...stuff: any) {
    this.pushStr(logToStr(...stuff));
  }
  private enter(prefix: string, str: string) {
    this.pushStr(str);
    this.indents.push(prefix);
    this.depth++;
  }
  private leave() {
    this.indents.pop();
    this.depth--;
  }
  private appendToPreviousStr(str: string) {
    this.lines[this.lines.length - 1] = this.lines[this.lines.length - 1] + str;
  }
  appendToPrevious(...stuff: any) {
    this.appendToPreviousStr(logToStr(...stuff));
  }
  private async insideStr<T>(prefix: string, str: string, code: () => Promise<T>): Promise<T> {
    this.enter(prefix, str);
    try {
      return await code();
    } finally {
      this.leave();
    }
  }
  async inside<T>(prefix: string, stuff: any[], code: () => Promise<T>): Promise<T> {
    return this.insideStr(prefix, logToStr(...stuff), code);
  }
}
