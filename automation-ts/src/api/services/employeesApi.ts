import { AppApi, ok } from '../appApi';
import { byUserName, listOf, Row } from '../rows';

/** "1" = active in الموظفين */
export const ACTIVE = '1';

/** الموظفين (Employees) by API as the portal calls it - the TS twin of api.services.EmployeesApi: find and delete. */
export class EmployeesApi {
  constructor(private readonly admin: AppApi) {}

  /** the employee of exactly this user name; undefined when the list has none */
  async find(userName: string): Promise<Row | undefined> {
    const data = { SearchTerm: userName, statusId: 0, RoleId: 0, DepartementIds: [], EmployeeType: '' };
    return byUserName(listOf(ok(await this.admin.post(this.path('User/GetAllUser'), { pageNumber: 1, pageSize: 10, data }), 'User/GetAllUser')), userName);
  }

  /** the trash icon in الموظفين */
  async delete(userId: string): Promise<void> {
    ok(await this.admin.post(this.path('User/Delete'), { Data: { UserId: userId } }), 'User/Delete');
  }

  private path(call: string): string {
    return this.admin.underRoot('api', call);
  }
}
