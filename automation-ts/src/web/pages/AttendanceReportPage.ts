import { Page } from '@playwright/test';
import { By } from '../by';
import { openPortalPath } from '../portalAddress';
import { WebActions } from '../webActions';
import { DayRangeFilter } from './DayRangeFilter';
import { pageOpens } from '../pageOpening';

/** the figures of the employee's day row, "HH:mm" each, as the report shows them */
export interface ReportFigures {
  checkIn: string;
  checkOut: string;
  actualHours: string;
  lateArrival: string;
  earlyArrival: string;
  shortage: string;
  earlyCheckOut: string;
  overtime: string;
}

/** each figure's column header (Java UserWorkReportPage) */
const HEADERS: Readonly<Record<keyof ReportFigures, string>> = {
  checkIn: 'توقيت الحضور',
  checkOut: 'توقيت الانصراف',
  actualHours: 'ساعات الدوام الفعلي',
  lateArrival: 'تأخير حضور',
  earlyArrival: 'حضور مبكر',
  shortage: 'النقص في الدوام',
  earlyCheckOut: 'انصراف مبكر',
  overtime: 'العمل الإضافي',
};

/** the report table as read: its header cells and its rows (each row's first cell is its number, or the total row's name) */
export interface ReportTable {
  headers: string[];
  rows: string[][];
}

/** the column of a header: the one named exactly so, else the first that contains the name; -1 when none */
function columnOf(headers: string[], name: string): number {
  const exact = headers.indexOf(name);
  return exact >= 0 ? exact : headers.findIndex((h) => h.includes(name));
}

/** the figures of the day row (row number 1); a column the report does not show reads '' */
export function figuresOf(table: ReportTable): ReportFigures {
  const row = table.rows.find((r) => r[0] === '1') ?? [];
  const figure = (key: keyof ReportFigures): string => row[columnOf(table.headers, HEADERS[key])] ?? '';
  return Object.fromEntries((Object.keys(HEADERS) as Array<keyof ReportFigures>).map((k) => [k, figure(k)])) as unknown as ReportFigures;
}

/**
 * The attendance report of one employee (الحضور والانصراف لموظف, /reports/user-work) - the TS twin of Java UserWorkReportPage:
 * the day, the employee (searched by job number - names repeat on Test), and the day row's figures read from the whole
 * table in one look (the columns the right-to-left table has scrolled away included). The portal runs in Arabic.
 */
export class AttendanceReportPage extends WebActions {
  private readonly pageTitle = By.xpath("//h1[contains(text(),' الحضور والانصراف لموظف ')]");
  private readonly employeesField = By.xpath("//input[@placeholder='الموظفين']");
  private readonly reportTable = By.xpath("//table[.//thead//th[normalize-space()='توقيت الحضور']]");
  private readonly dayRow = By.xpath("//table[.//thead//th[normalize-space()='توقيت الحضور']]//tbody/tr[normalize-space(*[1])='1']");

  constructor(page: Page) {
    super(page);
  }

  private employeeOption(fullName: string): string {
    return By.xpath("//mat-option//span[normalize-space()='" + fullName + "']");
  }

  async openReport(): Promise<void> {
    await pageOpens(this.page, 'The attendance report', 30, async () => {
      await openPortalPath(this.page, '/reports/user-work');
      return this.isShownWithin(this.pageTitle, 30);
    });
    await this.settled(20);
  }

  /** the day (yyyy-MM-dd) as from and to */
  async showDay(day: string): Promise<void> {
    await new DayRangeFilter(this.page).showDays(day, day);
  }

  /** the employee searched by job number and picked by name (the list redraws while results come in: clicked again, 3 tries) */
  async showEmployee(jobNumber: string, fullName: string): Promise<void> {
    await this.type(this.employeesField, 10, jobNumber, 'Employees');
    for (let attempt = 1; ; attempt++) {
      try {
        await this.click(this.employeeOption(fullName), 10, fullName);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
      }
    }
    await this.settled(30);
  }

  /** the day row's figures, once the report has drawn it (up to 30 s) */
  async figures(): Promise<ReportFigures> {
    if ((await this.rowsShownWithin(this.dayRow, 30)) === 0) throw new Error('The report showed no day row within 30 s of picking the employee');
    const table = await this.at(this.reportTable).evaluate((t) => {
      const clean = (c: Element): string => (c.textContent ?? '').replace(/\s+/g, ' ').trim();
      return { headers: Array.from(t.querySelectorAll('thead tr th')).map(clean),
               rows: Array.from(t.querySelectorAll('tbody tr')).map((r) => Array.from(r.children).map(clean)) };
    });
    return figuresOf(table);
  }
}
