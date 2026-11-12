import { CallFacts } from '../report/networkEvents';
import { AppLine } from './logcatLine';

/**
 * Reads one way apps write their HTTP calls to the phone's log (OkHttp, Dio ...): fed the app's lines in order, it gives
 * each call once it is complete; flush gives what was left open when the case ended. A new way is one more reader.
 */
export interface CallLogReader {
  read(line: AppLine): CallFacts[];
  flush(): CallFacts[];
}
