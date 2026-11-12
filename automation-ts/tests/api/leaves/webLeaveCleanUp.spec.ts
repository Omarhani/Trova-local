import { trovaTest as test } from '../../../src/run/trovaTest';
import { webLeaveKind } from '../../../src/api/records/webLeaveKind';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { once } from '../../../src/records/recordKind';
import { adminLeaves } from '../../web/leaveRequests/webLeaveOfRun';

/** deletes by id the leaves the admin added for the run's employee and the test did not delete, each read back deleted */
test('cleanUpWebLeavesProgrammatically', async () => {
  await cleanUpRun([webLeaveKind(once(adminLeaves))]);
});
