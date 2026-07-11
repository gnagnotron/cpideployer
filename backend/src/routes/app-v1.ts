import { Router, Request, Response } from 'express';
import { authRequired, orgRequired, requireOrgRoles } from '../middleware/auth';
import { supabaseAdminClient } from '../lib/supabase';
import { decryptSecret, encryptSecret } from '../lib/crypto';
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

router.get('/cpi/packages', async (req: Request, res: Response) => {
  const environmentId = typeof req.query.environmentId === 'string' ? req.query.environmentId : '';
  if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });

  try {
    const tenant = await loadTenantContext(req, environmentId);
    const data = await cpiGet<{ d?: { results?: unknown[] } }>(tenant, 'IntegrationPackages');
    return res.json((data.d?.results ?? []) as unknown[]);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/cpi/artifacts', async (req: Request, res: Response) => {
  const environmentId = typeof req.query.environmentId === 'string' ? req.query.environmentId : '';
  const packageId = typeof req.query.packageId === 'string' ? req.query.packageId : undefined;
  if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });

  try {
    const tenant = await loadTenantContext(req, environmentId);
    const artifacts = await getAllArtifacts(tenant, packageId);
    return res.json(artifacts);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/cpi/runtime-artifacts', async (req: Request, res: Response) => {
  const environmentId = typeof req.query.environmentId === 'string' ? req.query.environmentId : '';
  if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });

  try {
    const tenant = await loadTenantContext(req, environmentId);
    const data = await cpiGet<{ d?: { results?: unknown[] } }>(tenant, 'IntegrationRuntimeArtifacts');
    return res.json((data.d?.results ?? []) as unknown[]);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/cpi/tenant-diff', async (req: Request, res: Response) => {
  const { sourceEnvironmentId, targetEnvironmentId, customerLabel } = req.body as {
    sourceEnvironmentId?: string;
    targetEnvironmentId?: string;
    customerLabel?: string;
  };

  if (!sourceEnvironmentId || !targetEnvironmentId) {
    return res.status(400).json({ error: 'sourceEnvironmentId and targetEnvironmentId are required' });
  }

  const startedAt = Date.now();

  try {
    const [sourceEnv, targetEnv] = await Promise.all([
      loadEnvironmentInfo(req, sourceEnvironmentId),
      loadEnvironmentInfo(req, targetEnvironmentId),
    ]);

    const [sourcePackagesRaw, targetPackagesRaw, sourceArtifactsRaw, targetArtifactsRaw] = await Promise.all([
      cpiGet<{ d?: { results?: PackageItem[] } }>(sourceEnv.tenant, 'IntegrationPackages'),
      cpiGet<{ d?: { results?: PackageItem[] } }>(targetEnv.tenant, 'IntegrationPackages'),
      getAllArtifacts(sourceEnv.tenant),
      getAllArtifacts(targetEnv.tenant),
    ]);

    const sourcePackages = sourcePackagesRaw.d?.results ?? [];
    const targetPackages = targetPackagesRaw.d?.results ?? [];

    const sourceIflows = toIflowItems(sourceArtifactsRaw);
    const targetIflows = toIflowItems(targetArtifactsRaw);

    const packageDiff = comparePackages(sourcePackages, targetPackages);
    const iflowDiff = compareIflows(sourceIflows, targetIflows);

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);

    await writeAudit(req, 'compare_tenants', 'tenant_diff', `${sourceEnvironmentId}->${targetEnvironmentId}`, {
      customerLabel: customerLabel ?? null,
      sourceEnvironmentId,
      targetEnvironmentId,
      durationSeconds,
      sourcePackages: sourcePackages.length,
      targetPackages: targetPackages.length,
      sourceIflows: sourceIflows.length,
      targetIflows: targetIflows.length,
    });

    return res.json({
      summary: {
        sourcePackages: sourcePackages.length,
        targetPackages: targetPackages.length,
        sourceIflows: sourceIflows.length,
        targetIflows: targetIflows.length,
        packageNotTransported: packageDiff.notTransported.length,
        packageSynced: packageDiff.synced.length,
        packageOnlyInTarget: packageDiff.onlyInTarget.length,
        iflowNotTransported: iflowDiff.notTransported.length,
        iflowVersionMismatch: iflowDiff.versionMismatch.length,
        iflowSynced: iflowDiff.synced.length,
        iflowOnlyInTarget: iflowDiff.onlyInTarget.length,
      },
      packages: packageDiff,
      iflows: iflowDiff,
      metadata: {
        timestamp: new Date().toISOString(),
        durationSeconds,
        customerLabel: customerLabel ?? null,
        source: {
          environmentId: sourceEnv.id,
          environmentName: sourceEnv.name,
        },
        target: {
          environmentId: targetEnv.id,
          environmentName: targetEnv.name,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/cpi/deploy', async (req: Request, res: Response) => {
  const { environmentId, artifacts } = req.body as {
    environmentId?: string;
    artifacts?: Array<{ id: string; version: string; type?: string }>;
  };

  if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });
  if (!artifacts || artifacts.length === 0) {
    return res.status(400).json({ error: 'artifacts is required and cannot be empty' });
  }

  try {
    const tenant = await loadTenantContext(req, environmentId);
    const csrf = await fetchCsrfToken(tenant);
    const results: Array<{ id: string; status: 'success' | 'error'; message?: string }> = [];

    for (const artifact of artifacts) {
      try {
        const taskId = await deployArtifact(tenant, artifact.id, artifact.version, csrf);
        const status = await waitForDeploy(tenant, taskId);
        if (status === 'COMPLETED') {
          results.push({ id: artifact.id, status: 'success' });
        } else {
          results.push({ id: artifact.id, status: 'error', message: `Deploy ended with status: ${status}` });
        }
      } catch (error) {
        results.push({ id: artifact.id, status: 'error', message: (error as Error).message });
      }
    }

    await writeAudit(req, 'bulk_deploy', 'environment', environmentId, {
      count: artifacts.length,
      successCount: results.filter((r) => r.status === 'success').length,
    });

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/cpi/undeploy', async (req: Request, res: Response) => {
  const { environmentId, artifactIds } = req.body as {
    environmentId?: string;
    artifactIds?: string[];
  };

  if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });
  if (!artifactIds || artifactIds.length === 0) {
    return res.status(400).json({ error: 'artifactIds is required and cannot be empty' });
  }

  try {
    const tenant = await loadTenantContext(req, environmentId);
    const csrf = await fetchCsrfToken(tenant);
    const results: Array<{ id: string; status: 'success' | 'error'; message?: string }> = [];

    for (const artifactId of artifactIds) {
      try {
        await undeployArtifact(tenant, artifactId, csrf);
        results.push({ id: artifactId, status: 'success' });
      } catch (error) {
        results.push({ id: artifactId, status: 'error', message: (error as Error).message });
      }
    }

    await writeAudit(req, 'bulk_undeploy', 'environment', environmentId, {
      count: artifactIds.length,
      successCount: results.filter((r) => r.status === 'success').length,
    });

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
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
    .select('id, role, created_at, user_id')
    .eq('organization_id', req.org!.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const members = data ?? [];
  const userIds = members.map((row: any) => row.user_id as string);

  const { data: profileRows } = await supabaseAdminClient
    .from('profiles')
    .select('user_id, email, full_name')
    .in('user_id', userIds);

  const profileByUserId = new Map<string, { email: string | null; full_name: string | null }>();
  for (const row of profileRows ?? []) {
    profileByUserId.set(row.user_id as string, {
      email: (row.email as string | null) ?? null,
      full_name: (row.full_name as string | null) ?? null,
    });
  }

  const authFallbackByUserId = new Map<string, { email: string | null; fullName: string | null }>();
  for (const userId of userIds) {
    const profile = profileByUserId.get(userId);
    if (profile?.email || profile?.full_name) continue;

    const { data: userData } = await supabaseAdminClient.auth.admin.getUserById(userId);
    const email = userData.user?.email ?? null;
    const fullName =
      (userData.user?.user_metadata?.full_name as string | undefined) ??
      (userData.user?.user_metadata?.name as string | undefined) ??
      null;

    authFallbackByUserId.set(userId, { email, fullName });
  }

  return res.json(
    members.map((row: any) => {
      const userId = row.user_id as string;
      const profile = profileByUserId.get(userId);
      const fallback = authFallbackByUserId.get(userId);

      return {
        id: row.id,
        userId,
        role: row.role,
        createdAt: row.created_at,
        email: profile?.email ?? fallback?.email ?? null,
        fullName: profile?.full_name ?? fallback?.fullName ?? null,
      };
    })
  );
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

type TenantContext = {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
};

type PackageItem = {
  Id: string;
  Name: string;
  Version?: string;
};

type IflowItem = {
  Id: string;
  Name: string;
  Version: string;
  PackageId: string;
};

type PackageCompareItem = {
  name: string;
  sourceVersion?: string;
  targetVersion?: string;
};

type IflowCompareItem = {
  name: string;
  sourceVersion?: string;
  targetVersion?: string;
  sourceId?: string;
  targetId?: string;
  sourcePackageId?: string;
  targetPackageId?: string;
};

type CpiArtifactType = 'IntegrationFlow' | 'ValueMapping' | 'ScriptCollection' | 'MessageMapping';

const DESIGNTIME_TYPES: CpiArtifactType[] = [
  'IntegrationFlow',
  'ValueMapping',
  'ScriptCollection',
  'MessageMapping',
];

const TYPE_RESOURCE: Record<CpiArtifactType, string> = {
  IntegrationFlow: 'IntegrationDesigntimeArtifacts',
  ValueMapping: 'ValueMappingDesigntimeArtifacts',
  ScriptCollection: 'ScriptCollectionDesigntimeArtifacts',
  MessageMapping: 'MessageMappingDesigntimeArtifacts',
};

async function loadTenantContext(req: Request, environmentId: string): Promise<TenantContext> {
  const { data, error } = await supabaseAdminClient
    .from('environments')
    .select('id, base_url, token_url, client_id, service_key_enc')
    .eq('id', environmentId)
    .eq('organization_id', req.org!.id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Environment not found');
  }

  const serviceKeyRaw = decryptSecret(data.service_key_enc as string);
  const parsed = parseServiceKeyForSecret(serviceKeyRaw);
  if (!parsed.clientSecret) {
    throw new Error('Service key does not contain client secret');
  }

  return {
    baseUrl: (data.base_url as string).replace(/\/$/, ''),
    tokenUrl: (data.token_url as string).replace(/\/$/, ''),
    clientId: data.client_id as string,
    clientSecret: parsed.clientSecret,
  };
}

async function loadEnvironmentInfo(
  req: Request,
  environmentId: string
): Promise<{ id: string; name: string; tenant: TenantContext }> {
  const { data, error } = await supabaseAdminClient
    .from('environments')
    .select('id, name, base_url, token_url, client_id, service_key_enc')
    .eq('id', environmentId)
    .eq('organization_id', req.org!.id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Environment not found');
  }

  const serviceKeyRaw = decryptSecret(data.service_key_enc as string);
  const parsed = parseServiceKeyForSecret(serviceKeyRaw);
  if (!parsed.clientSecret) {
    throw new Error(`Service key for environment ${data.name as string} does not contain client secret`);
  }

  return {
    id: data.id as string,
    name: data.name as string,
    tenant: {
      baseUrl: (data.base_url as string).replace(/\/$/, ''),
      tokenUrl: (data.token_url as string).replace(/\/$/, ''),
      clientId: data.client_id as string,
      clientSecret: parsed.clientSecret,
    },
  };
}

function parseServiceKeyForSecret(value: string): { clientSecret: string } {
  try {
    let json = JSON.parse(value);
    if (json.oauth && typeof json.oauth === 'object') json = json.oauth;
    const clientSecret =
      (json.clientsecret || json.client_secret || json.clientSecret || '').toString().trim();
    return { clientSecret };
  } catch {
    return { clientSecret: '' };
  }
}

async function getAccessToken(tenant: TenantContext): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: tenant.clientId,
    client_secret: tenant.clientSecret,
  });

  const response = await fetch(tenant.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Cannot get CPI access token (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('CPI token response has no access_token');
  }
  return payload.access_token;
}

async function cpiGet<T>(tenant: TenantContext, path: string): Promise<T> {
  const token = await getAccessToken(tenant);
  const response = await fetch(`${tenant.baseUrl}/api/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`CPI GET failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function fetchCsrfToken(tenant: TenantContext): Promise<string> {
  const token = await getAccessToken(tenant);
  const response = await fetch(`${tenant.baseUrl}/api/v1/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': 'Fetch',
      Accept: 'application/json',
    },
  });

  const csrf = response.headers.get('X-CSRF-Token');
  if (!csrf) {
    throw new Error('Could not retrieve CSRF token from CPI');
  }
  return csrf;
}

async function cpiPost(tenant: TenantContext, path: string, csrf: string): Promise<string> {
  const token = await getAccessToken(tenant);
  const response = await fetch(`${tenant.baseUrl}/api/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrf,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`CPI POST failed (${response.status}): ${await response.text()}`);
  }

  const raw = await response.text();
  if (!raw.trim()) return '';
  try {
    const parsed = JSON.parse(raw) as { d?: { TaskId?: string } };
    return parsed.d?.TaskId ?? '';
  } catch {
    return raw.trim().replace(/^"|"$/g, '');
  }
}

async function cpiDelete(tenant: TenantContext, path: string, csrf: string): Promise<void> {
  const token = await getAccessToken(tenant);
  const response = await fetch(`${tenant.baseUrl}/api/v1/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrf,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`CPI DELETE failed (${response.status}): ${await response.text()}`);
  }
}

async function deployArtifact(
  tenant: TenantContext,
  id: string,
  version: string,
  csrf: string
): Promise<string> {
  const path = `DeployIntegrationDesigntimeArtifact?Id='${encodeURIComponent(id)}'&Version='${encodeURIComponent(version)}'`;
  return cpiPost(tenant, path, csrf);
}

async function pollDeployStatus(
  tenant: TenantContext,
  taskId: string
): Promise<{ status: string; errorMessage?: string }> {
  if (!taskId) return { status: 'COMPLETED' };

  const normalizedTaskId = taskId.replace(/^"|"$/g, '');
  const path = `BuildAndDeployStatus(TaskId='${encodeURIComponent(normalizedTaskId)}')`;
  const token = await getAccessToken(tenant);
  const response = await fetch(`${tenant.baseUrl}/api/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Poll deploy status failed (${response.status}): ${await response.text()}`);
  }

  const body = await response.text();
  if (!body.trim()) return { status: 'PROCESSING' };

  try {
    const data = JSON.parse(body) as {
      d?: { Status?: string; DeployedArtifact?: { ErrorInformation?: { LastErrorMessage?: string } } };
    };
    if (data.d?.Status) {
      return {
        status: data.d.Status,
        errorMessage: data.d.DeployedArtifact?.ErrorInformation?.LastErrorMessage,
      };
    }
  } catch {
    // Ignore and continue with textual status fallback.
  }

  const upper = body.trim().replace(/^"|"$/g, '').toUpperCase();
  return { status: upper || 'PROCESSING' };
}

async function waitForDeploy(
  tenant: TenantContext,
  taskId: string,
  timeoutMs = 60_000
): Promise<'COMPLETED' | 'FAILED' | 'TIMEOUT'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const { status } = await pollDeployStatus(tenant, taskId);
    if (status === 'COMPLETED' || status === 'SUCCESS') return 'COMPLETED';
    if (status === 'FAILED' || status === 'ERROR') return 'FAILED';
  }
  return 'TIMEOUT';
}

async function undeployArtifact(tenant: TenantContext, id: string, csrf: string): Promise<void> {
  await cpiDelete(tenant, `IntegrationRuntimeArtifacts('${encodeURIComponent(id)}')`, csrf);
}

async function getAllArtifacts(tenant: TenantContext, packageId?: string): Promise<unknown[]> {
  const packageIds = packageId ? [packageId] : await getPackageIds(tenant);
  const all: unknown[] = [];

  for (const pkgId of packageIds) {
    for (const type of DESIGNTIME_TYPES) {
      try {
        const path = `IntegrationPackages('${encodeURIComponent(pkgId)}')/${TYPE_RESOURCE[type]}`;
        const data = await cpiGet<{ d?: { results?: Array<Record<string, unknown>> } }>(tenant, path);
        const items = (data.d?.results ?? []).map((row) => ({ ...row, Type: type }));
        all.push(...items);
      } catch {
        // Continue when one designtime type is unavailable for this tenant/package.
      }
    }
  }

  return all;
}

function toIflowItems(input: unknown[]): IflowItem[] {
  return input
    .map((row) => row as { Type?: string; Id?: string; Name?: string; Version?: string; PackageId?: string })
    .filter((row) => row.Type === 'IntegrationFlow' && !!row.Id && !!row.Name && !!row.Version)
    .map((row) => ({
      Id: row.Id as string,
      Name: row.Name as string,
      Version: row.Version as string,
      PackageId: (row.PackageId as string | undefined) ?? '',
    }));
}

function comparePackages(sourcePackages: PackageItem[], targetPackages: PackageItem[]) {
  const targetByName = new Map<string, PackageItem>();
  for (const item of targetPackages) targetByName.set(item.Name, item);

  const sourceByName = new Map<string, PackageItem>();
  for (const item of sourcePackages) sourceByName.set(item.Name, item);

  const notTransported: PackageCompareItem[] = [];
  const synced: PackageCompareItem[] = [];
  const onlyInTarget: PackageCompareItem[] = [];

  for (const source of sourcePackages) {
    const target = targetByName.get(source.Name);
    if (!target) {
      notTransported.push({ name: source.Name, sourceVersion: source.Version });
    } else {
      synced.push({ name: source.Name, sourceVersion: source.Version, targetVersion: target.Version });
    }
  }

  for (const target of targetPackages) {
    const source = sourceByName.get(target.Name);
    if (!source) {
      onlyInTarget.push({ name: target.Name, targetVersion: target.Version });
    }
  }

  return { notTransported, synced, onlyInTarget };
}

function compareIflows(sourceIflows: IflowItem[], targetIflows: IflowItem[]) {
  const targetByName = new Map<string, IflowItem>();
  for (const item of targetIflows) targetByName.set(item.Name, item);

  const sourceByName = new Map<string, IflowItem>();
  for (const item of sourceIflows) sourceByName.set(item.Name, item);

  const notTransported: IflowCompareItem[] = [];
  const versionMismatch: IflowCompareItem[] = [];
  const synced: IflowCompareItem[] = [];
  const onlyInTarget: IflowCompareItem[] = [];

  for (const source of sourceIflows) {
    const target = targetByName.get(source.Name);
    if (!target) {
      notTransported.push({
        name: source.Name,
        sourceVersion: source.Version,
        sourceId: source.Id,
        sourcePackageId: source.PackageId,
      });
      continue;
    }

    if (source.Version === target.Version) {
      synced.push({
        name: source.Name,
        sourceVersion: source.Version,
        targetVersion: target.Version,
        sourceId: source.Id,
        targetId: target.Id,
        sourcePackageId: source.PackageId,
        targetPackageId: target.PackageId,
      });
    } else {
      versionMismatch.push({
        name: source.Name,
        sourceVersion: source.Version,
        targetVersion: target.Version,
        sourceId: source.Id,
        targetId: target.Id,
        sourcePackageId: source.PackageId,
        targetPackageId: target.PackageId,
      });
    }
  }

  for (const target of targetIflows) {
    const source = sourceByName.get(target.Name);
    if (!source) {
      onlyInTarget.push({
        name: target.Name,
        targetVersion: target.Version,
        targetId: target.Id,
        targetPackageId: target.PackageId,
      });
    }
  }

  return { notTransported, versionMismatch, synced, onlyInTarget };
}

async function getPackageIds(tenant: TenantContext): Promise<string[]> {
  const data = await cpiGet<{ d?: { results?: Array<{ Id: string }> } }>(tenant, 'IntegrationPackages');
  return (data.d?.results ?? []).map((pkg) => pkg.Id);
}

export default router;
