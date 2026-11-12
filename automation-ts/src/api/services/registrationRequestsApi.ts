import { appAnswer } from '../appAnswer';
import { AppApi, ok } from '../appApi';
import { byUserName, listOf, Row } from '../rows';

function ids(answer: unknown): string[] {
  const data = (answer as { Data?: unknown } | null)?.Data;
  return Array.isArray(data) ? data.map((r) => String((r as Row).ID)) : [];
}

/**
 * طلبات التسجيل (Registration requests) by API as the portal calls it - the TS twin of api.services.RegistrationRequestsApi:
 * the list, the review screen's "approve" with every department and employee group, and the delete.
 */
export class RegistrationRequestsApi {
  constructor(private readonly admin: AppApi) {}

  /** the request of exactly this user name; undefined when the list has none */
  async findPending(userName: string): Promise<Row | undefined> {
    const body = { pageNumber: 1, pageSize: 10, data: { SearchPattern: userName, DepartmentsIDs: [] } };
    return byUserName(listOf(ok(await this.admin.post(this.path('User/GetAllUserPending'), body), 'User/GetAllUserPending')), userName);
  }

  /** a department's id by its Arabic or English name, from the add-employee drawer's list (permission 2108) */
  async departmentId(name: string): Promise<string> {
    const answer = ok(await this.admin.post(this.path('Department/GetAllDepartmentByAdminID'), { Data: [2108] }), 'Department/GetAllDepartmentByAdminID');
    const rows = (answer as { Data?: Row[] } | null)?.Data ?? [];
    const found = rows.find((d) => d.NameAr === name || d.NameEn === name);
    if (!found) throw new Error(`The account has no department called ${name}`);
    return String(found.ID);
  }

  /** every department id - the review screen's "select all departments" */
  async allDepartmentIds(): Promise<string[]> {
    const data = { DepartmentID: '', IncludeChilds: true, AllStatus: false, SearchTerm: '', WithNoBio: true };
    return ids(ok(await this.admin.post(this.path('Department/GetAllDepartments'), { data }), 'Department/GetAllDepartments'));
  }

  /** every employee group id - the review screen's "select all groups" */
  async allEmployeeGroupIds(): Promise<string[]> {
    return ids(ok(await this.admin.get(this.path('EmployeeGroup/GetGroupsByAccountId')), 'EmployeeGroup/GetGroupsByAccountId'));
  }

  /** "الموافقة على الطلب": state 1 (active) with these departments and groups; the app's own words when it refuses */
  async approve(userId: string, departmentIds: string[], groupIds: string[]): Promise<{ ok: boolean; message: string }> {
    const Data = { State: 1, UserID: userId, DepartmentsIDs: departmentIds, IsImagesVerified: false, IsVoicesVerified: false,
                   UserImages: [], UserVoices: [], pendingRequestType: 0, AcceptOrRejectRequest: true, EmployeeGroups: groupIds };
    return appAnswer(await this.admin.post(this.path('User/ChangeUserStates'), { Data }));
  }

  async deleteRequest(requestId: string): Promise<void> {
    ok(await this.admin.post(this.path('User/DeleteRequest'), { Data: { UserId: requestId, RejectionReason: '' } }), 'User/DeleteRequest');
  }

  private path(call: string): string {
    return this.admin.underRoot('api', call);
  }
}
