import { trovaTest as test } from '../../../src/run/trovaTest';
import { cleanUpMade } from '../../../src/run/cleanUpMade';
import { runRecords } from '../../../src/run/runRecords';
import { checkTrue } from '../../../src/report/checks';
import { adminLeaves, MADE_WEB_LEAVES, webLeaveRecords } from '../../web/leaveRequests/webLeaveOfRun';

/** deletes by API the leaves the admin added for the run's employee and did not delete (deleted = gone), and checks each */
test('cleanUpWebLeavesProgrammatically', async () => {
  const made = runRecords.newestFirst(MADE_WEB_LEAVES);
  test.skip(made.length === 0, 'Every leave this run added was deleted - nothing to delete');
  const left = await cleanUpMade(made, webLeaveRecords(await adminLeaves()), (id) => runRecords.forget(MADE_WEB_LEAVES, id));
  checkTrue(`Clean-up · the ${made.length} leave(s) this run added are deleted`, left.length === 0, left.length ? `still there: ${left.join(', ')}` : '');
});
