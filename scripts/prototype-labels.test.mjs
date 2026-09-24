import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitial } from '../lib/fixtures.ts';
import { withRichDemo } from '../lib/demo-enrichment.ts';
import { withFindingContext } from '../lib/finding-context.ts';
import { normalizeLegacyLabels } from '../lib/prototype-labels.ts';

test('legacy label cleanup preserves saved decisions and user-written content', () => {
  const input = withFindingContext(withRichDemo(createInitial()));
  const call = input.calls.find(c => c.id === 'CALL-UI-1');
  call.customer = '演示客户 1';
  const custom = input.calls.find(c => c.id === 'CALL-UI-2');
  custom.customer = '用户填写的演示客户';
  const resource = input.resources.find(r => r.id === 'RES-SERVICE-TIME');
  resource.name = '业务处理时限告知要求（演示）';
  const review = input.reviews.find(r => r.id === 'WO-1039');
  review.rev = 4;
  review.summary = '已核对，保留人工意见';
  const output = normalizeLegacyLabels(input);
  assert.equal(output.calls.find(c => c.id === call.id).customer, '客户 1');
  assert.equal(output.calls.find(c => c.id === custom.id).customer, custom.customer);
  assert.equal(output.resources.find(r => r.id === resource.id).name, '业务处理时限告知要求');
  assert.deepEqual(output.reviews, input.reviews);
  assert.deepEqual(output.findings, input.findings);
  assert.deepEqual(output.logs, input.logs);
  assert.equal(call.customer, '演示客户 1');
  assert.deepEqual(normalizeLegacyLabels(output), output);
});
