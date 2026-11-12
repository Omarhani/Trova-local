/** Make automation (round 2): the project's code Trova reads, and the draft it offers the tester. */

/** a source file of the project (path from automation-ts, with /) */
export interface CodeFile {
  path: string;
  text: string;
}

/** a file Trova would write: a new one, or the whole new text of a changed one */
export interface DraftFile extends CodeFile {
  isNew: boolean;
}

export type DraftKind = 'web' | 'phone' | 'hybrid' | 'api';

export interface Draft {
  kind: DraftKind;
  /** why nothing can be made, in plain words; then there is nothing to save */
  refused?: string;
  /** page, screen and API classes added or changed */
  files: DraftFile[];
  /** the test */
  spec: DraftFile;
  /** its trap twin: the same test with one wrong expectation - its run must fail */
  trap: DraftFile;
  /** the test's name (testAdminAddsALeaveType) */
  method: string;
  /** the suite blocks to add to the tester's suite: the case, then its clean-up */
  suiteBlocks: string;
  /** the blocks of the trap's proof run */
  trapBlocks: string;
  /** existing methods the test calls ("InvoicesPage.enterNotes") */
  reused: string[];
  /** methods Trova adds ("InvoicesPage.enterDiscount") */
  added: string[];
  /** the business cycle of the case in plain words (make/cyclePicture), shown to the tester and at the top of the test */
  picture: string[];
}
