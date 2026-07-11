import { Router, Request, Response } from 'express';
import { authRequired, orgRequired, requireOrgRoles } from '../middleware/auth';
import { supabaseAdminClient } from '../lib/supabase';
import { encryptSecret } from '../lib/crypto';
import { OrgRole } from '../types/auth';

const router = Router();

router.use(authRequired);

router.get('/auth/me', async (req: Request, res: Response) => {
  return res.json({
    userId: req.auth!.userId,
    email: req.auth!.email,
    memberships: req.auth!.memberships,
  });
});

router.post('/auth/bootstrap', async (req: Request, res: Response) => {
  try {
    const { organizationName, fullName } = req.body as { organizationName?: string; fullName?: string };
    if (!organizationName || organizationName.trim().length < 2) {
      return res.status(400).json({ error: 'organizationName is required (at least 2 chars)' });
    }

    const orgSlug = slugify(organizationName);

    const { error: profileError } = await supabaseAdminClient
      .from('profiles')
      .upsert(
        {
          user_id: req.auth!.userId,
          email: req.auth!.email,
          full_name: fullName ?? null,
        },
        { onConflict: 'user_id' }
      );
    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    let organizationId: string;
    let isNewOrganization = false;

    const { data: existingOrg, error: orgLookupError } = await supabaseAdminClient
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', orgSlug)
      .maybeSingle();

    if (orgLookupError) {
      return res.status(500).json({ error: orgLookupError.message });
    }

    if (existingOrg?.id) {
      organizationId = existingOrg.id;
    } else {
      const { data: newOrg, error: newOrgError } = await supabaseAdminClient
        .from('organizations')
        .insert({
          name: organizationName.trim(),
          slug: orgSlug,
        })
        .select('id')
        .single();

      if (newOrgError || !newOrg) {
        return res.status(500).json({ error: newOrgError?.message ?? 'Cannot create organization' });
      }
      organizationId = newOrg.id;
      isNewOrganization = true;
    }

    const role: OrgRole = isNewOrganization ? 'owner' : 'member';

    const { error: membershipError } = await supabaseAdminClient
      .from('organization_members')
      .upsert(
        {
          organization_id: organizationId,
          user_id: req.auth!.userId,
          role,
        },
        { onConflict: 'organization_id,user_id' }
      );

    if (membershipError) {
      return res.status(500).json({ error: membershipError.message });
    }

    return res.status(201).json({
      organizationId,
      role,
      organizationSlug: orgSlug,
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.use(orgRequired);

router.get('/environments', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdminClient
    .from('environments')
    .select('id, name, base_url, token_url, client_id, created_at, updated_at, created_by, updated_by')
    .eq('organization_id', req.org!.id)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

router.post('/environments', async (req: Request, res: Response) => {
  const body = req.body as {
    name?: string;
    baseUrl?: string;
    tokenUrl?: string;
    clientId?: string;
    serviceKey?: string;
  };

  if (!body.name || !body.baseUrl || !body.tokenUrl || !body.clientId || !body.serviceKey) {
    return res.status(400).json({
      error: 'name, baseUrl, tokenUrl, clientId, serviceKey are required',
    });
  }

  const { data, error } = await supabaseAdminClient
    .from('environments')
    .insert({
      organization_id: req.org!.id,
      name: body.name,
      base_url: body.baseUrl,
      token_url: body.tokenUrl,
      client_id: body.clientId,
      service_key_enc: encryptSecret(body.serviceKey),
      created_by: req.auth!.userId,
      updated_by: req.auth!.userId,
    })
    .select('id, name, base_url, token_url, client_id, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'create_environment', 'environment', data.id, {
    name: data.name,
  });

  return res.status(201).json(data);
});

router.put('/environments/:id', async (req: Request, res: Response) => {
  const body = req.body as {
    name?: string;
    baseUrl?: string;
    tokenUrl?: string;
    clientId?: string;
    serviceKey?: string;
  };

  const patch: Record<string, string> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.baseUrl !== undefined) patch.base_url = body.baseUrl;
  if (body.tokenUrl !== undefined) patch.token_url = body.tokenUrl;
  if (body.clientId !== undefined) patch.client_id = body.clientId;
  if (body.serviceKey !== undefined) patch.service_key_enc = encryptSecret(body.serviceKey);

  const { data, error } = await supabaseAdminClient
    .from('environments')
    .update({ ...patch, updated_by: req.auth!.userId })
    .eq('id', req.params.id)
    .eq('organization_id', req.org!.id)
    .select('id, name, base_url, token_url, client_id, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'update_environment', 'environment', data.id, {
    name: data.name,
  });

  return res.json(data);
});

router.delete('/environments/:id', async (req: Request, res: Response) => {
  const { error } = await supabaseAdminClient
    .from('environments')
    .delete()
    .eq('id', req.params.id)
    .eq('organization_id', req.org!.id);

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'delete_environment', 'environment', req.params.id, {});

  return res.status(204).send();
});

router.get('/presets', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdminClient
    .from('presets')
    .select('id, name, payload, created_at, updated_at, created_by, updated_by')
    .eq('organization_id', req.org!.id)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

router.post('/presets', async (req: Request, res: Response) => {
  const body = req.body as { name?: string; payload?: unknown };
  if (!body.name || body.payload === undefined) {
    return res.status(400).json({ error: 'name and payload are required' });
  }

  const { data, error } = await supabaseAdminClient
    .from('presets')
    .insert({
      organization_id: req.org!.id,
      name: body.name,
      payload: body.payload,
      created_by: req.auth!.userId,
      updated_by: req.auth!.userId,
    })
    .select('id, name, payload, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'create_preset', 'preset', data.id, { name: data.name });

  return res.status(201).json(data);
});

router.put('/presets/:id', async (req: Request, res: Response) => {
  const body = req.body as { name?: string; payload?: unknown };
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.payload !== undefined) patch.payload = body.payload;

  const { data, error } = await supabaseAdminClient
    .from('presets')
    .update({ ...patch, updated_by: req.auth!.userId })
    .eq('id', req.params.id)
    .eq('organization_id', req.org!.id)
    .select('id, name, payload, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'update_preset', 'preset', data.id, { name: data.name });

  return res.json(data);
});

router.delete('/presets/:id', async (req: Request, res: Response) => {
  const { error } = await supabaseAdminClient
    .from('presets')
    .delete()
    .eq('id', req.params.id)
    .eq('organization_id', req.org!.id);

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'delete_preset', 'preset', req.params.id, {});

  return res.status(204).send();
});

router.get('/audit', requireOrgRoles(['owner', 'admin']), async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const { data, error } = await supabaseAdminClient
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, payload, created_at, actor_user_id')
    .eq('organization_id', req.org!.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

router.get('/admin/members', requireOrgRoles(['owner', 'admin']), async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdminClient
    .from('organization_members')
    .select('id, role, created_at, user_id, profiles(full_name, email)')
    .eq('organization_id', req.org!.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.json((data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    email: row.profiles?.email ?? null,
    fullName: row.profiles?.full_name ?? null,
  })));
});

router.patch('/admin/members/:id/role', requireOrgRoles(['owner', 'admin']), async (req: Request, res: Response) => {
  const role = req.body?.role as OrgRole | undefined;
  if (!role || !['owner', 'admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'role must be owner, admin, or member' });
  }

  const { data, error } = await supabaseAdminClient
    .from('organization_members')
    .update({ role })
    .eq('id', req.params.id)
    .eq('organization_id', req.org!.id)
    .select('id, role')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await writeAudit(req, 'update_member_role', 'organization_member', data.id, { role: data.role });

  return res.json(data);
});

async function writeAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  await supabaseAdminClient.from('audit_logs').insert({
    organization_id: req.org!.id,
    actor_user_id: req.auth!.userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    payload,
  });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default router;
