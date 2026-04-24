export interface Command {
  readonly name: string;
  do(): void;
  undo(): void;
  /** 可选合并：连续同类命令合并为一个（典型用例：拖动过程的多次 move） */
  mergeWith?(next: Command): Command | null;
}

/** 把多个命令打包为一个可整体 undo 的批命令。用于"载入模板"等复合操作。*/
export class BatchCommand implements Command {
  constructor(
    readonly name: string,
    private cmds: Command[],
  ) {}

  do() {
    for (const c of this.cmds) c.do();
  }

  undo() {
    for (let i = this.cmds.length - 1; i >= 0; i--) this.cmds[i].undo();
  }
}
