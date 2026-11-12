import { caseTest, cleanUpTest } from './caseTests';
import { cyclePicture } from './cyclePicture';
import { CodeFile, Draft, DraftKind } from './draft';
import { channelOf, kindOf } from './kindOf';
import { MadeRun } from './madeRun';
import { testName, testPaths } from './names';
import { MakeRefusal, PartMaker } from './partMaker';
import { PomProject } from './pomProject';
import { NO_CHECK, runRefusal } from './runRefusal';
import { guardSecrets } from './secretGuard';
import { specText } from './specWriter';
import { suiteBlocks } from './suiteBlocks';
import { SpecUses } from './testWriter';
import { trapText } from './trapWriter';

function refusedDraft(kind: DraftKind, refused: string): Draft {
  const none = { path: '', text: '', isNew: false };
  return { kind, refused, files: [], spec: none, trap: none, method: '', suiteBlocks: '', trapBlocks: '', reused: [], added: [], picture: [] };
}

function made(run: MadeRun, kind: DraftKind, code: CodeFile[]): Draft {
  const channel = channelOf(run);
  const project = new PomProject(code);
  const parts = new PartMaker(project);
  const uses = new SpecUses();
  const method = testName(run.title, run.caseId);
  const main = caseTest(run, channel, parts, uses, method);
  const last = main.checks[main.checks.length - 1];
  if (!last) return refusedDraft(kind, NO_CHECK);
  const clean = cleanUpTest(run, parts, uses, method);
  const paths = testPaths(channel === 'phone' ? 'mobile' : channel, method);
  const picture = cyclePicture(run);
  const text = specText(channel, run, clean ? [main, clean] : [main], uses, picture);
  return {
    kind, files: project.changed(), method,
    spec: { path: paths.spec, text, isNew: true },
    trap: { path: paths.trap, text: trapText(text, method, last), isNew: true },
    ...suiteBlocks({ run, channel, method, cleanUp: clean?.name, spec: paths.spec, trap: paths.trap }),
    reused: parts.reused, added: parts.added, picture,
  };
}

/**
 * Make automation: one passed case of an AI run -> a test on the project's own page, screen and API classes, its trap
 * twin and its suite blocks - or why none is made, in plain words. Nothing here runs or saves anything.
 */
export function makeAutomation(run: MadeRun, code: CodeFile[]): Draft {
  const guarded = guardSecrets(run);
  const kind = kindOf(guarded.run);
  const refused = runRefusal(run) ?? guarded.refused;
  if (refused) return refusedDraft(kind, refused);
  try {
    return made(guarded.run, kind, code);
  } catch (e) {
    if (e instanceof MakeRefusal) return refusedDraft(kind, e.message);
    throw e;
  }
}
