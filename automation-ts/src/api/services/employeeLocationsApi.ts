import { appAnswer } from '../appAnswer';
import { AppApi, ok } from '../appApi';
import { listOf, Row } from '../rows';

/** the assign drawer's list filter for one employee (the portal's own body) */
function userFilter(userId: string): { pageNumber: number; pageSize: number; data: Record<string, string> } {
  return { pageNumber: 1, pageSize: 50, data: { SearchPattern: '', DepartmentId: '', UserId: userId } };
}

/** the id of the row named name in Arabic or English; a plain error naming what was looked for */
function idByName(rows: Row[], name: string, what: string): string {
  const found = rows.find((r) => r.NameAr === name || r.NameEn === name);
  if (!found) throw new Error(`The account has no ${what} called ${name}`);
  return String(found.ID);
}

/**
 * Edit employee > Locations by API as the portal calls it - the TS twin of api.services.EmployeeLocationsApi: the
 * "Assign locations" drawer's two lists (location, location group), its Save, and the employee's Locations tab.
 */
export class EmployeeLocationsApi {
  constructor(private readonly admin: AppApi) {}

  /** a location's id by its Arabic or English name, from the drawer's location tab */
  async assignableLocationId(userId: string, name: string): Promise<string> {
    return idByName(await this.rows('Location/GetAllLocationForDepartment_Users', userFilter(userId)), name, 'location');
  }

  /** a location group's id by its Arabic or English name, from the drawer's location group tab */
  async assignableGroupId(userId: string, name: string): Promise<string> {
    return idByName(await this.rows('GateGroup/GetGateGroupsForDepartment_Users', userFilter(userId)), name, 'location group');
  }

  /** the drawer's Save: adds these to what the employee has (it does not replace it); the app's own words when it refuses */
  async assign(userId: string, locationIds: string[], groupIds: string[]): Promise<{ ok: boolean; message: string }> {
    const Data = { AccessGateIds: locationIds, GateGroupIds: groupIds, UserId: userId };
    return appAnswer(await this.admin.post(this.path('User/AssigntGatesAndAccessGateToUser'), { Data }));
  }

  /** the names (Arabic and English) the employee's Locations tab lists - locations and location groups alike */
  async assignedNames(userId: string): Promise<string[]> {
    const rows = await this.rows('User/GetAllAccessGatesByUserID', { pageNumber: 1, pageSize: 50, Data: userId });
    return rows.flatMap((r) => [r.NameAr, r.NameEn].filter((n): n is string => typeof n === 'string' && n.trim() !== ''));
  }

  private async rows(call: string, body: Parameters<AppApi['post']>[1]): Promise<Row[]> {
    return listOf(ok(await this.admin.post(this.path(call), body), call));
  }

  private path(call: string): string {
    return this.admin.underRoot('api', call);
  }
}
