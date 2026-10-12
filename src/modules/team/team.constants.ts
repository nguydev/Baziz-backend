/**
 * Team & Permissions — 26 permission keys (matches Flutter TeamService)
 */

export const ALL_PERMISSIONS = [
  'prop_view',
  'prop_edit',
  'prop_create',
  'prop_delete',
  'tenant_view',
  'tenant_edit',
  'tenant_invite',
  'maint_view',
  'maint_manage',
  'fin_view_acct',
  'fin_edit_acct',
  'fin_view_reports',
  'fin_edit_reports',
  'doc_view',
  'doc_edit',
  'msg_view',
  'msg_send',
  'mkt_view',
  'mkt_manage',
  'proj_view',
  'proj_edit',
  'proj_create',
  'proj_delete',
  'admin_team',
  'admin_billing',
  'admin_settings',
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_META: Record<
  PermissionKey,
  { label: string; category: string; description: string }
> = {
  prop_view: { label: 'View Properties', category: 'Properties', description: 'View property list and details' },
  prop_edit: { label: 'Edit Properties', category: 'Properties', description: 'Update existing properties' },
  prop_create: { label: 'Create Properties', category: 'Properties', description: 'Add new properties' },
  prop_delete: { label: 'Delete Properties', category: 'Properties', description: 'Remove properties' },
  tenant_view: { label: 'View Tenants', category: 'Tenants', description: 'View tenant and lease info' },
  tenant_edit: { label: 'Edit Tenants', category: 'Tenants', description: 'Manage tenant records' },
  tenant_invite: { label: 'Invite Tenants', category: 'Tenants', description: 'Send tenant invitations' },
  maint_view: { label: 'View Maintenance', category: 'Maintenance', description: 'View maintenance requests' },
  maint_manage: { label: 'Manage Maintenance', category: 'Maintenance', description: 'Update maintenance status' },
  fin_view_acct: { label: 'View Finances', category: 'Finance', description: 'View rent payments and accounts' },
  fin_edit_acct: { label: 'Edit Finances', category: 'Finance', description: 'Record and edit payments' },
  fin_view_reports: { label: 'View Reports', category: 'Finance', description: 'View financial reports' },
  fin_edit_reports: { label: 'Edit Reports', category: 'Finance', description: 'Generate and export reports' },
  doc_view: { label: 'View Documents', category: 'Documents', description: 'View property documents' },
  doc_edit: { label: 'Edit Documents', category: 'Documents', description: 'Upload and delete documents' },
  msg_view: { label: 'View Messages', category: 'Messaging', description: 'View chat conversations' },
  msg_send: { label: 'Send Messages', category: 'Messaging', description: 'Send chat messages' },
  mkt_view: { label: 'View Marketplace', category: 'Marketplace', description: 'Browse marketplace listings' },
  mkt_manage: { label: 'Manage Marketplace', category: 'Marketplace', description: 'Create and manage listings' },
  proj_view: { label: 'View Projects', category: 'Projects', description: 'View assigned projects' },
  proj_edit: { label: 'Edit Projects', category: 'Projects', description: 'Edit project details' },
  proj_create: { label: 'Create Projects', category: 'Projects', description: 'Create new projects' },
  proj_delete: { label: 'Delete Projects', category: 'Projects', description: 'Delete projects' },
  admin_team: { label: 'Manage Team', category: 'Admin', description: 'Invite members and manage roles' },
  admin_billing: { label: 'Manage Billing', category: 'Admin', description: 'Access billing and subscription' },
  admin_settings: { label: 'Org Settings', category: 'Admin', description: 'Manage organization settings' },
};

export const SYSTEM_ROLE_KEYS = [
  'owner',
  'co_owner',
  'property_manager',
  'accountant',
  'virtual_assistant',
  'contractor',
  'viewer',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

const viewOnly = ALL_PERMISSIONS.filter((k) => k.endsWith('_view') || k === 'msg_send');

export const SYSTEM_ROLE_DEFINITIONS: Array<{
  key: SystemRoleKey;
  name: string;
  description: string;
  enabledKeys: PermissionKey[];
}> = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access to everything including billing',
    enabledKeys: [...ALL_PERMISSIONS],
  },
  {
    key: 'co_owner',
    name: 'Co-owner',
    description: 'Full access except billing management',
    enabledKeys: ALL_PERMISSIONS.filter((k) => k !== 'admin_billing'),
  },
  {
    key: 'property_manager',
    name: 'Property Manager',
    description: 'Manage properties, tenants, and maintenance',
    enabledKeys: [
      'prop_view',
      'prop_edit',
      'prop_create',
      'tenant_view',
      'tenant_edit',
      'tenant_invite',
      'maint_view',
      'maint_manage',
      'doc_view',
      'doc_edit',
      'msg_view',
      'msg_send',
      'mkt_view',
      'proj_view',
      'proj_edit',
      'proj_create',
    ],
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Finance and reporting access',
    enabledKeys: [
      'prop_view',
      'tenant_view',
      'fin_view_acct',
      'fin_edit_acct',
      'fin_view_reports',
      'fin_edit_reports',
      'doc_view',
      'msg_view',
    ],
  },
  {
    key: 'virtual_assistant',
    name: 'Virtual Assistant',
    description: 'Support tasks and messaging',
    enabledKeys: [
      'prop_view',
      'tenant_view',
      'maint_view',
      'doc_view',
      'msg_view',
      'msg_send',
      'mkt_view',
      'proj_view',
    ],
  },
  {
    key: 'contractor',
    name: 'Contractor',
    description: 'Maintenance and assigned project work',
    enabledKeys: ['maint_view', 'maint_manage', 'proj_view', 'msg_view', 'msg_send', 'doc_view'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    enabledKeys: viewOnly as PermissionKey[],
  },
];

export const OWNER_ROLE_KEY: SystemRoleKey = 'owner';
export const INVITE_TOKEN_EXPIRY_DAYS = 7;
