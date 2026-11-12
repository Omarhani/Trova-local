import { Made, RecordKind, settled } from '../../records/recordKind';
import { EmployeesApi } from '../services/employeesApi';
import { RegistrationRequestsApi } from '../services/registrationRequestsApi';
import { EMPLOYEE } from './recordKeys';

const REQUEST = 'registration request';

/** the admin's two lists an employee of the run can be in */
export interface EmployeeLists {
  employees: EmployeesApi;
  requests: RegistrationRequestsApi;
}

/**
 * The run's employees wherever they are by now - in الموظفين (approved) or still in طلبات التسجيل - found by user
 * name, deleted by id the way the portal does it, read back by that id.
 */
export function employeeKind(lists: () => Promise<EmployeeLists>): RecordKind {
  return {
    ...EMPLOYEE,
    idOf: async (userName: string): Promise<Made | undefined> => {
      const { employees, requests } = await lists();
      const active = await employees.find(userName);
      if (active?.ID !== undefined) return { entry: userName, id: String(active.ID), noun: EMPLOYEE.noun };
      const pending = await requests.findPending(userName);
      return pending?.ID === undefined ? undefined : { entry: userName, id: String(pending.ID), noun: REQUEST };
    },
    delete: async (m: Made) => {
      const { employees, requests } = await lists();
      return settled(() => (m.noun === REQUEST ? requests.deleteRequest(m.id) : employees.delete(m.id)));
    },
    isThere: async (m: Made) => {
      const { employees, requests } = await lists();
      const row = m.noun === REQUEST ? await requests.findPending(m.entry) : await employees.find(m.entry);
      return row !== undefined && String(row.ID) === m.id;
    },
  };
}
