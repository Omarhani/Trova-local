import { expect, test } from '@playwright/test';
import { shapeOf, wrap } from '../../src/trova/phoneShape';

const recipe = { callShape: { headers: { type: 'flutter' }, envelope: { UserID: '{{signIn:USER_ID}}', RequestId: '{{new:id}}', Data: '{{data}}' } } };

test('the envelope takes the sign-in ids and the headers stay as learned', () => {
  const shape = shapeOf(recipe, { USER_ID: 'u1' });
  expect(shape.headers).toEqual({ type: 'flutter' });
  expect(shape.envelope?.UserID).toBe('u1');
});

test('a payload goes into Data with a fresh request id', () => {
  const out = wrap(shapeOf(recipe, { USER_ID: 'u1' }), { Id: 3 }) as Record<string, unknown>;
  expect(out.Data).toEqual({ Id: 3 });
  expect(out.RequestId).toMatch(/^[0-9a-f-]{36}$/);
});

test('a body that already has Data is sent as it is', () => {
  expect(wrap(shapeOf(recipe, {}), { Data: 1 })).toEqual({ Data: 1 });
});

test('a sign-in value that was not kept becomes null, never a made-up id', () => {
  expect(shapeOf(recipe, {}).envelope?.UserID).toBeNull();
});

test('no call shape = the body goes as it is', () => {
  expect(wrap(shapeOf({}, {}), { a: 1 })).toEqual({ a: 1 });
});
