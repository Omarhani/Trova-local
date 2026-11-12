import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { attachmentNames, attachmentPath, attachmentsDir, attachmentText } from '../../src/web/attachments';

let dir: string;

test.beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-attachments-'));
  fs.writeFileSync(path.join(dir, 'Employees.xlsx'), 'x');
  fs.writeFileSync(path.join(dir, 'body.json'), '{"a":"ب"}', 'utf8');
  fs.writeFileSync(path.join(dir, '.written'), 'runner list');
});

test.afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an attachment is found by its name in any case (utils.Attachments)', () => {
  expect(attachmentPath('employees.XLSX', dir)).toBe(path.join(dir, 'Employees.xlsx'));
  expect(attachmentText('BODY.json', dir)).toBe('{"a":"ب"}');
});

test("the names leave out the runner's own hidden list, sorted", () => {
  expect(attachmentNames(dir)).toEqual(['body.json', 'Employees.xlsx']);
  expect(attachmentNames(path.join(dir, 'none'))).toEqual([]);
});

test('a missing attachment fails in plain words, naming what is there', () => {
  expect(() => attachmentPath('photo.png', dir)).toThrow('No attachment "photo.png" (there are: body.json, Employees.xlsx) - upload it in Trova > Test Data > Attachments; a run from Trova brings it here');
});

test("the folder: the run's own, else the project's data/attachments", () => {
  expect(attachmentsDir({ TROVA_ATTACHMENTS_DIR: 'D:/x' })).toBe('D:/x');
  expect(attachmentsDir({}).replace(/\\/g, '/')).toMatch(/\/data\/attachments$/);
});
