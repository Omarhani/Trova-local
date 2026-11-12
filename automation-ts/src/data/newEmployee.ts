/** an employee a run makes (names, user name, job number) - never its password; id once the app gave one */
export interface NewEmployee {
  firstName: string;
  lastName: string;
  userName: string;
  jobNumber: string;
  id?: string;
  /** pending = signed up, waiting for the admin; approved = active in Employees */
  state?: 'pending' | 'approved';
}

export interface NewEmployeeInput {
  /** the scenario ("apiCycle"): its letters name the employee and start its job number */
  tag: string;
  /** the run stamp: a new employee every run */
  stamp: string;
  /** the user name (an e-mail), already with the stamp in it */
  userName: string;
  firstName: string;
}

/** the stamp as letters (names take letters only): digit 0-9 = A-J, a letter stays - the Java TestEmployee way */
export function lettersOf(stamp: string): string {
  return stamp.replace(/[0-9]/g, (d) => String.fromCharCode(65 + Number(d)));
}

/**
 * The run's new employee, the TS twin of api.models.TestEmployee.generate: "<first> <Tag><stamp as letters>",
 * job number TAG+STAMP (at most 20), user name in lower case (the app keeps it so).
 */
export function newEmployee(input: NewEmployeeInput): NewEmployee {
  let scenario = input.tag.replace(/[^A-Za-z]/g, '');
  if (scenario.length < 2) scenario = 'Api';
  scenario = scenario.slice(0, Math.max(2, 20 - input.stamp.length));
  return {
    firstName: input.firstName,
    lastName: scenario.charAt(0).toUpperCase() + scenario.slice(1) + lettersOf(input.stamp),
    userName: input.userName.trim().toLowerCase(),
    jobNumber: (scenario + input.stamp).toUpperCase().slice(0, 20),
  };
}

export function fullName(e: Pick<NewEmployee, 'firstName' | 'lastName'>): string {
  return `${e.firstName} ${e.lastName}`;
}

/** the password after a change: the old one and one more digit (at most 40 characters, the app's limit) */
export function nextPassword(old: string): string {
  return old.length < 40 ? `${old}7` : `${old.slice(0, 39)}${old.endsWith('7') ? '8' : '7'}`;
}

/** the new employee's user name: the admin's e-mail with "+<tag><stamp>" before the @, lower case (Java TestEmployee) */
export function userNameFor(adminMail: string, tag: string, stamp: string): string {
  const at = adminMail.indexOf('@');
  if (at < 1) throw new Error("The admin login has no e-mail to name the new employee by - give the new employee's user name in the suite");
  const scenario = tag.replace(/[^A-Za-z]/g, '') || 'api';
  return `${adminMail.slice(0, at)}+${scenario}${stamp}${adminMail.slice(at)}`.toLowerCase();
}
