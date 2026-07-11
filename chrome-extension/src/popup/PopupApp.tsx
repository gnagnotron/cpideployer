import React, { useEffect, useState, useCallback } from "react";
import type {
  StorageData,
  DesigntimeArtifact,
  RuntimeArtifact,
  IntegrationPackage,
  ArtifactType,
  OperationLogEntry,
} from "../types";
import { sendMessage } from "../messaging";
import { ArtifactList } from "./components/ArtifactList";
import { PresetManager } from "./components/PresetManager";
import { OperationLog } from "./components/OperationLog";

type Tab = "artifacts" | "presets" | "log";

function ellipsize(value: string, max = 44): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function Popup() {
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [packages, setPackages] = useState<IntegrationPackage[]>([]);
  const [artifacts, setArtifacts] = useState<DesigntimeArtifact[]>([]);
  const [runtime, setRuntime] = useState<RuntimeArtifact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterPackageId, setFilterPackageId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [operating, setOperating] = useState(false);
  const [opResults, setOpResults] = useState<OperationLogEntry["artifacts"] | null>(null);
  const [tab, setTab] = useState<Tab>("artifacts");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadStorage(); }, []);

  async function loadStorage() {
    const data = await sendMessage<StorageData>({ type: "GET_STORAGE" });
    setStorage(data);
    setTheme(data.theme ?? 'dark');
    const tid = data.activeTenantId ?? data.tenants[0]?.id ?? null;
    setActiveTenantId(tid);
    if (tid) fetchData(tid);
  }

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const updated = await sendMessage<StorageData>({ type: 'SET_THEME', theme: next });
    setStorage(updated);
    setTheme(updated.theme ?? next);
  }

  const fetchData = useCallback(async (tenantId: string, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      console.log('[Popup] Fetching data for tenant:', tenantId);
      const [pkgs, arts, rt] = await Promise.all([
        sendMessage<IntegrationPackage[]>({ type: "GET_PACKAGES", tenantId, forceRefresh }),
        sendMessage<DesigntimeArtifact[]>({ type: "GET_ARTIFACTS", tenantId, forceRefresh }),
        sendMessage<RuntimeArtifact[]>({ type: "GET_RUNTIME_ARTIFACTS", tenantId, forceRefresh }),
      ]);
      console.log('[Popup] Data fetched successfully:', { packages: pkgs.length, artifacts: arts.length, runtime: rt.length });
      setPackages(pkgs);
      setArtifacts(arts);
      setRuntime(rt);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[Popup] Fetch error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  async function switchTenant(id: string) {
    setActiveTenantId(id);
    setSelectedIds(new Set());
    setFilterPackageId("");
    await sendMessage({ type: "SET_ACTIVE_TENANT", tenantId: id });
    fetchData(id);
  }

  async function handleBulkDeploy() {
    if (!activeTenantId || selectedIds.size === 0) return;
    setOperating(true);
    setOpResults(null);
    try {
      console.log('[Popup] Starting bulk deploy for', selectedIds.size, 'artifacts');
      const selected = artifacts.filter((a) => selectedIds.has(a.Id));
      const results = await sendMessage<OperationLogEntry["artifacts"]>({
        type: "DEPLOY",
        tenantId: activeTenantId,
        artifacts: selected.map((a) => ({ id: a.Id, version: a.Version, type: a.Type as ArtifactType })),
      });
      console.log('[Popup] Deploy results:', results);
      setOpResults(results);
      const rt = await sendMessage<RuntimeArtifact[]>({ type: "GET_RUNTIME_ARTIFACTS", tenantId: activeTenantId, forceRefresh: true });
      setRuntime(rt);
      const updated = await sendMessage<StorageData>({ type: "GET_STORAGE" });
      setStorage(updated);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[Popup] Deploy error:', errorMsg);
      setError(errorMsg);
    } finally {
      setOperating(false);
    }
  }

  async function handleBulkUndeploy() {
    if (!activeTenantId || selectedIds.size === 0) return;
    if (!confirm(`Undeploy ${selectedIds.size} artifact(s)?`)) return;
    setOperating(true);
    setOpResults(null);
    try {
      console.log('[Popup] Starting bulk undeploy for', selectedIds.size, 'artifacts');
      const results = await sendMessage<OperationLogEntry["artifacts"]>({
        type: "UNDEPLOY",
        tenantId: activeTenantId,
        artifactIds: Array.from(selectedIds),
      });
      console.log('[Popup] Undeploy results:', results);
      setOpResults(results);
      const rt = await sendMessage<RuntimeArtifact[]>({ type: "GET_RUNTIME_ARTIFACTS", tenantId: activeTenantId, forceRefresh: true });
      setRuntime(rt);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('[Popup] Undeploy error:', errorMsg);
      setError(errorMsg);
    } finally {
      setOperating(false);
    }
  }

  function applyPreset(ids: { id: string; type: ArtifactType }[]) {
    setSelectedIds(new Set(ids.map((x) => x.id)));
    setTab("artifacts");
  }

  const tenants = storage?.tenants ?? [];
  const displayedArtifacts = artifacts.filter((a) => {
    const matchPkg = !filterPackageId || a.PackageId === filterPackageId;
    const matchSearch = !searchTerm || a.Name.toLowerCase().includes(searchTerm.toLowerCase()) || a.Id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchPkg && matchSearch;
  });

  if (!storage) return <div className="p-4 text-sm text-gray-500">Loading...</div>;

  if (tenants.length === 0) {
    return (
      <div className={`${theme === 'dark' ? 'bg-[#070c14] text-slate-100' : 'bg-slate-50 text-slate-900'} p-6 text-center min-h-[500px]`}>
        <p className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'} mb-3 text-sm`}>No tenants configured.</p>
        <button onClick={() => chrome.runtime.openOptionsPage()} className={`${theme === 'dark' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-blue-600 hover:bg-blue-700'} px-4 py-2 text-white rounded text-sm`}>Open Settings</button>
      </div>
    );
  }

  return (
    <div className={`${theme === 'dark' ? 'bg-[#070c14] text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col h-full text-sm`}>
      <div className={`${theme === 'dark' ? 'bg-[#0b1220] text-cyan-100 border-b border-cyan-500/30' : 'bg-blue-700 text-white'} px-4 py-2 flex items-center justify-between gap-2`}>
        <span className="font-semibold text-base">SAP CPI Deployer</span>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className={`${theme === 'dark' ? 'border-amber-400/70 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30' : 'border-blue-300 bg-blue-600/30 text-white hover:bg-blue-600/50'} border px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <select
            value={activeTenantId ?? ""}
            onChange={(e) => switchTenant(e.target.value)}
            className={`${theme === 'dark' ? 'bg-[#09101d] text-cyan-100 border-cyan-500/40' : 'bg-blue-600 text-white border-blue-400'} text-xs border rounded px-2 py-1 min-w-0 max-w-[220px] truncate`}
            title={tenants.find((t) => t.id === activeTenantId)?.name ?? ''}
          >
            {tenants.map((t) => <option key={t.id} value={t.id} title={t.name}>{ellipsize(t.name, 34)}</option>)}
          </select>
          <button onClick={() => chrome.runtime.openOptionsPage()} title="Settings" className={`${theme === 'dark' ? 'text-cyan-300 hover:text-white' : 'text-blue-200 hover:text-white'} text-base`}>&#9881;</button>
        </div>
      </div>

      <div className={`${theme === 'dark' ? 'border-b border-cyan-500/20 bg-[#0b1220]' : 'border-b bg-white'}`}>
        {(["artifacts", "presets", "log"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium border-b-2 ${
              tab === t
                ? (theme === 'dark' ? 'border-cyan-400 text-cyan-200' : 'border-blue-600 text-blue-700')
                : (theme === 'dark' ? 'border-transparent text-slate-400 hover:text-cyan-200' : 'border-transparent text-gray-500 hover:text-gray-700')
            }`}
          >
            {t === "artifacts" ? "Artifacts" : t === "presets" ? "Presets" : "Log"}
          </button>
        ))}
      </div>

      {error && (
        <div className={`${theme === 'dark' ? 'bg-rose-500/10 text-rose-200 border-rose-500/30' : 'bg-red-50 text-red-700 border-b'} text-xs px-4 py-2 border-b flex items-center justify-between`}>
          <span>{error}</span>
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {opResults && (
        <div className={`${theme === 'dark' ? 'bg-[#0b1220] border-cyan-500/20 text-slate-200' : 'bg-gray-50'} border-b px-4 py-2 text-xs max-h-24 overflow-y-auto`}>
          <span className="font-medium">Last operation: </span>
          <span className={`${theme === 'dark' ? 'text-emerald-300' : 'text-green-700'}`}>{opResults.filter((r) => r.status === "success").length} OK</span>
          {" / "}
          <span className={`${theme === 'dark' ? 'text-rose-300' : 'text-red-700'}`}>{opResults.filter((r) => r.status === "error").length} errors</span>
          {opResults.filter((r) => r.status === "error").map((r) => (
            <div key={r.id} className={`${theme === 'dark' ? 'text-rose-300' : 'text-red-600'} mt-1 truncate`}>x {r.name}: {r.message}</div>
          ))}
          <button className={`${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'} mt-1 underline`} onClick={() => setOpResults(null)}>dismiss</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === "artifacts" && (
          <>
            <div className={`${theme === 'dark' ? 'bg-[#0b1220] border-cyan-500/20' : 'bg-white border-b'} flex gap-2 p-2 border-b items-center min-w-0`}>
              <select
                value={filterPackageId}
                onChange={(e) => setFilterPackageId(e.target.value)}
                className={`${theme === 'dark' ? 'bg-[#09101d] border-cyan-500/30 text-slate-200' : 'border'} rounded px-2 py-1 text-xs flex-[1_1_0%] min-w-0 truncate`}
                title={packages.find((p) => p.Id === filterPackageId)?.Name ?? 'All packages'}
              >
                <option value="">All packages</option>
                {packages.map((p) => <option key={p.Id} value={p.Id} title={p.Name}>{ellipsize(p.Name, 42)}</option>)}
              </select>
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${theme === 'dark' ? 'bg-[#09101d] border-cyan-500/30 text-slate-100 placeholder:text-slate-400' : 'border'} rounded px-2 py-1 text-xs flex-[1_1_0%] min-w-0`} />
              <button onClick={() => activeTenantId && fetchData(activeTenantId, true)} disabled={loading} title="Refresh" className={`${theme === 'dark' ? 'bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 border border-cyan-500/40' : 'bg-gray-100 hover:bg-gray-200'} text-xs px-2 py-1 rounded disabled:opacity-50`}>{loading ? "..." : "↻"}</button>
            </div>
            {loading ? (
              <div className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} p-4 text-center text-xs`}>Loading artifacts...</div>
            ) : (
              <ArtifactList theme={theme} artifacts={displayedArtifacts} runtime={runtime} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
            )}
          </>
        )}
        {tab === "presets" && storage && (
          <PresetManager theme={theme} storage={storage} currentSelection={Array.from(selectedIds).map((id) => { const a = artifacts.find((x) => x.Id === id); return { id, type: (a?.Type ?? "IntegrationFlow") as ArtifactType }; })} onApplyPreset={applyPreset} onStorageChange={setStorage} />
        )}
        {tab === "log" && storage && <OperationLog theme={theme} entries={storage.operationLog} />}
      </div>

      {tab === "artifacts" && (
        <div className={`${theme === 'dark' ? 'bg-[#0b1220] border-cyan-500/20' : 'bg-white'} flex items-center justify-between border-t px-3 py-2`}>
          <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'} text-xs`}>{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button onClick={handleBulkDeploy} disabled={operating || selectedIds.size === 0} className={`${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/60 hover:bg-emerald-500/30' : 'bg-green-600 text-white hover:bg-green-700'} text-xs px-3 py-1 rounded disabled:opacity-40`}>{operating ? "Working..." : "Deploy"}</button>
            <button onClick={handleBulkUndeploy} disabled={operating || selectedIds.size === 0} className={`${theme === 'dark' ? 'bg-rose-500/20 text-rose-100 border border-rose-400/60 hover:bg-rose-500/30' : 'bg-red-600 text-white hover:bg-red-700'} text-xs px-3 py-1 rounded disabled:opacity-40`}>{operating ? "..." : "Undeploy"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
