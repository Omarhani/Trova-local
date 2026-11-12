import { CodeFile, DraftFile } from './draft';
import { IndexedClass, indexCode } from './codeIndex';

interface Held {
  text: string;
  isNew: boolean;
  changed: boolean;
}

/**
 * Make automation: the project's page, screen and API classes as they stand while Trova writes - each part it adds is
 * read back at once, so a later step (or a later case) reuses it and never writes it twice.
 */
export class PomProject {
  private readonly files = new Map<string, Held>();
  private index?: IndexedClass[];

  constructor(code: CodeFile[]) {
    for (const f of code) this.files.set(f.path, { text: f.text, isNew: false, changed: false });
  }

  classes(): IndexedClass[] {
    this.index ??= indexCode([...this.files].map(([path, f]) => ({ path, text: f.text })));
    return this.index;
  }

  named(name: string): IndexedClass | undefined {
    return this.classes().find((c) => c.name === name);
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  put(path: string, text: string): void {
    const was = this.files.get(path);
    this.files.set(path, { text, isNew: was ? was.isNew : true, changed: true });
    this.index = undefined;
  }

  /** the files written or changed, in the order they were first written */
  changed(): DraftFile[] {
    return [...this.files].filter(([, f]) => f.changed).map(([path, f]) => ({ path, text: f.text, isNew: f.isNew }));
  }
}
