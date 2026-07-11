export type OrgRole = 'owner' | 'admin' | 'member';

export interface Membership {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrgRole;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  memberships: Membership[];
}

export interface OrgContext {
  id: string;
  role: OrgRole;
}
