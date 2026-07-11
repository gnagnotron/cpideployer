import { NextFunction, Request, Response } from 'express';
import { supabaseAdminClient, supabaseUserClient } from '../lib/supabase';
import { AuthContext, Membership, OrgRole } from '../types/auth';

function getBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

async function loadMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabaseAdminClient
    .from('organization_members')
    .select('id, organization_id, role, organizations(id, name, slug)')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Cannot load memberships: ${error.message}`);
  }

  return (data ?? [])
    .map((row: any) => {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      if (!org?.id) return null;
      return {
        id: row.id as string,
        organizationId: org.id as string,
        organizationName: org.name as string,
        organizationSlug: org.slug as string,
        role: row.role as OrgRole,
      };
    })
    .filter((row: Membership | null): row is Membership => row !== null);
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data, error } = await supabaseUserClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const memberships = await loadMemberships(data.user.id);
    const auth: AuthContext = {
      userId: data.user.id,
      email: data.user.email ?? null,
      memberships,
    };
    req.auth = auth;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication check failed', detail: (err as Error).message });
  }
}

export function orgRequired(req: Request, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const orgIdFromHeader = req.header('x-org-id');
  const orgIdFromQuery = typeof req.query.organizationId === 'string' ? req.query.organizationId : null;
  const orgIdFromBody = typeof req.body?.organizationId === 'string' ? req.body.organizationId : null;
  const orgId = orgIdFromHeader ?? orgIdFromQuery ?? orgIdFromBody;

  if (!orgId) {
    return res.status(400).json({ error: 'Missing organization id. Provide x-org-id header.' });
  }

  const membership = auth.memberships.find((m) => m.organizationId === orgId);
  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this organization' });
  }

  req.org = { id: membership.organizationId, role: membership.role };
  return next();
}

export function requireOrgRoles(roles: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.org) return res.status(400).json({ error: 'Organization context is required' });
    if (!roles.includes(req.org.role)) {
      return res.status(403).json({ error: `Role ${req.org.role} cannot perform this operation` });
    }
    return next();
  };
}
