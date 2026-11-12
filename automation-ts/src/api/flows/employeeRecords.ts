import { RecordApi } from '../../run/cleanUpMade';
import { EmployeesApi } from '../services/employeesApi';
import { RegistrationRequestsApi } from '../services/registrationRequestsApi';

const EMPLOYEE = 'employee:';
const REQUEST = 'request:';

/**
 * A run's employee wherever it is by now - in الموظفين (approved) or still in طلبات التسجيل - found by its user name and
 * deleted the way the portal does it (Java EmployeeApi.delete). For cleanUpMade: gone = in neither list.
 */
export function employeeRecords(employees: EmployeesApi, requests: RegistrationRequestsApi): RecordApi {
  return {
    idOf: async (userName) => {
      const active = await employees.find(userName);
      if (active?.ID !== undefined) return EMPLOYEE + String(active.ID);
      const pending = await requests.findPending(userName);
      return pending?.ID !== undefined ? REQUEST + String(pending.ID) : undefined;
    },
    delete: async (id) => {
      if (id.startsWith(EMPLOYEE)) await employees.delete(id.slice(EMPLOYEE.length));
      else await requests.deleteRequest(id.slice(REQUEST.length));
    },
  };
}
