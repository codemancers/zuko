import { describeScopes } from './oauth-scopes';

it('shows record, schema and directory access separately and hides identity plumbing', () => {
  expect(
    describeScopes(['openid', 'offline_access', 'records:read', 'schema:read', 'directory:read']),
  ).toEqual([
    'View records, their relationships and change history',
    'View object types, fields and relationship definitions',
    'View organization members and teams',
  ]);
});
