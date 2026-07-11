import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import type { Tenant, StorageData } from '../types';
import { sendMessage } from '../messaging';

const EMPTY_TENANT: Omit<Tenant, 'id'> = {
	name: '',
	baseUrl: '',
	tokenUrl: '',
	clientId: '',
	clientSecret: '',
};

export function Options() {
	const [tenants, setTenants] = useState<Tenant[]>([]);
	const [theme, setTheme] = useState<'dark' | 'light'>('dark');
	const [editing, setEditing] = useState<Tenant | null>(null);
	const [form, setForm] = useState<Omit<Tenant, 'id'>>(EMPTY_TENANT);
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
	const [jsonInput, setJsonInput] = useState('');
	const [parsing, setParsing] = useState(false);

	useEffect(() => {
		loadTenants();
	}, []);

	async function loadTenants() {
		const data = await sendMessage<StorageData>({ type: 'GET_STORAGE' });
		setTenants(data.tenants);
		setTheme(data.theme ?? 'dark');
	}

	async function toggleTheme() {
		const nextTheme = theme === 'dark' ? 'light' : 'dark';
		const updated = await sendMessage<StorageData>({ type: 'SET_THEME', theme: nextTheme });
		setTheme(updated.theme);
	}

	function startAdd() {
		setEditing(null);
		setForm(EMPTY_TENANT);
		setFeedback(null);
	}

	function startEdit(t: Tenant) {
		setEditing(t);
		setForm({ name: t.name, baseUrl: t.baseUrl, tokenUrl: t.tokenUrl, clientId: t.clientId, clientSecret: t.clientSecret });
		setFeedback(null);
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (!form.name || !form.baseUrl || !form.tokenUrl || !form.clientId || !form.clientSecret) {
			setFeedback({ type: 'err', msg: 'All fields are required.' });
			return;
		}
		setSaving(true);
		try {
			const tenant: Tenant = {
				id: editing?.id ?? crypto.randomUUID(),
				...form,
				baseUrl: form.baseUrl.replace(/\/$/, ''),
				tokenUrl: form.tokenUrl.replace(/\/$/, ''),
			};
			const updated = await sendMessage<StorageData>({ type: 'SAVE_TENANT', tenant });
			setTenants(updated.tenants);
			setEditing(null);
			setForm(EMPTY_TENANT);
			setFeedback({ type: 'ok', msg: `Tenant "${tenant.name}" saved.` });
		} catch (err) {
			setFeedback({ type: 'err', msg: (err as Error).message });
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(t: Tenant) {
		if (!confirm(`Delete tenant "${t.name}"?`)) return;
		const updated = await sendMessage<StorageData>({ type: 'DELETE_TENANT', tenantId: t.id });
		setTenants(updated.tenants);
		setFeedback({ type: 'ok', msg: `Tenant "${t.name}" deleted.` });
	}

	async function handleParseServiceKey() {
		if (!jsonInput.trim()) {
			setFeedback({ type: 'err', msg: 'JSON cannot be empty.' });
			return;
		}
		setParsing(true);
		try {
			let json = JSON.parse(jsonInput);
			
			// Support nested structure: { "oauth": { "clientid": "...", ... } }
			if (json.oauth && typeof json.oauth === 'object') {
				json = json.oauth;
			}
			
			const clientId = json.clientid || json.client_id || json.clientId || '';
			const clientSecret = json.clientsecret || json.client_secret || json.clientSecret || '';
			let tokenUrl = json.tokenurl || json.token_url || json.tokenUrl || '';
			let baseUrl = json.apiurl || json.api_url || json.apiUrl || json.url || '';
			
			if (!clientId || !clientSecret || !tokenUrl) {
				setFeedback({ type: 'err', msg: 'Service key missing required fields. Expected: clientid (or client_id), clientsecret (or client_secret), tokenurl (or token_url)' });
				return;
			}
			
			let tenantId = '';
			if (!baseUrl) {
				const tokenHost = new URL(tokenUrl).hostname;
				const parts = tokenHost.split('.');
				tenantId = parts[0];
				baseUrl = `https://${tenantId}.it-cpi.cloud.sap`;
			} else {
				// Extract tenant name from URL if present
				try {
					const urlObj = new URL(baseUrl);
					const hostname = urlObj.hostname;
					const hostParts = hostname.split('.');
					tenantId = hostParts[0];
				} catch {
					tenantId = `Tenant-${Date.now()}`;
				}
			}
			
			const tenantName = tenantId && tenantId !== 'https' ? tenantId : `Tenant-${Date.now()}`;
			setForm({
				name: tenantName,
				baseUrl: baseUrl.replace(/\/$/, ''),
				tokenUrl: tokenUrl.replace(/\/$/, ''),
				clientId,
				clientSecret,
			});
			setJsonInput('');
			setFeedback({ type: 'ok', msg: `Service key parsed. Review and save the tenant.` });
		} catch (err) {
			setFeedback({ type: 'err', msg: `Invalid JSON: ${(err as Error).message}` });
		} finally {
			setParsing(false);
		}
	}

	return (
		<div className={`${theme === 'dark'
			? 'min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0b1220_0%,#070b14_42%,#03060b_100%)]'
			: 'min-h-screen bg-[radial-gradient(circle_at_15%_0%,#f3f6ff_0%,#f7fafc_45%,#fff7ed_100%)]'} px-6 py-8 font-mono ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
			<div className="mx-auto w-full max-w-6xl">
				<div className={`mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-slate-300'}`}>
					<div>
						<p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${theme === 'dark' ? 'text-emerald-400' : 'text-blue-700'}`}>Terminal Console</p>
						<h1 className={`mt-2 text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-emerald-100' : 'text-slate-900'}`}>SAP CPI Deployer Setup</h1>
						<p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Configura tenant e service key in modalita operativa.</p>
					</div>
					<div className="flex items-center gap-3">
						<div className={`rounded border px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-300 bg-white text-slate-700'}`}>
							{tenants.length} tenant configured
						</div>
						<button
							onClick={toggleTheme}
							className={`rounded border px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'border-amber-400/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
						>
							{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
						</button>
					</div>
				</div>

				{feedback && (
					<div className={`mb-5 border px-4 py-3 text-sm ${feedback.type === 'ok'
						? (theme === 'dark' ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800')
						: (theme === 'dark' ? 'border-rose-400/60 bg-rose-500/10 text-rose-200' : 'border-rose-300 bg-rose-50 text-rose-800')}`}>
						{feedback.msg}
					</div>
				)}

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					<aside className="lg:col-span-4">
						<div className={`overflow-hidden border ${theme === 'dark' ? 'border-emerald-500/40 bg-[#05080f] text-white shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_30px_rgba(16,185,129,0.08)]' : 'border-slate-300 bg-white text-slate-900 shadow-sm'}`}>
							<div className={`border-b px-4 py-3 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-slate-200'}`}>
								<h2 className={`text-sm font-bold uppercase tracking-[0.16em] ${theme === 'dark' ? 'text-emerald-300' : 'text-slate-700'}`}>Configured Tenants</h2>
							</div>
							<div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
								{tenants.length === 0 && (
									<p className={`rounded border px-3 py-2 text-xs ${theme === 'dark' ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>No tenants yet. Start by importing a service key.</p>
								)}
								{tenants.map((t) => (
									<div key={t.id} className={`rounded border p-3 ${theme === 'dark' ? 'border-emerald-500/25 bg-[#0a1220]' : 'border-slate-200 bg-white'}`}>
										<p className={`truncate text-sm font-semibold ${theme === 'dark' ? 'text-emerald-200' : 'text-slate-800'}`}>{t.name}</p>
										<p className={`mt-1 truncate text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t.baseUrl}</p>
										<div className="mt-3 flex gap-2">
											<button
												onClick={() => startEdit(t)}
												className={`flex-1 border px-2 py-1 text-xs font-semibold ${theme === 'dark' ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
											>
												Edit
											</button>
											<button
												onClick={() => handleDelete(t)}
												className={`flex-1 border px-2 py-1 text-xs font-semibold ${theme === 'dark' ? 'border-rose-400/70 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25' : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
											>
												Delete
											</button>
										</div>
									</div>
								))}
							</div>
							<div className={`border-t px-4 py-3 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-slate-200'}`}>
								<button
									onClick={startAdd}
									className={`w-full border px-3 py-2 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'border-amber-400/70 bg-amber-500/25 text-amber-100 hover:bg-amber-500/35' : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
								>
									New Manual Tenant
								</button>
							</div>
						</div>
					</aside>

					<section className="space-y-6 lg:col-span-8">
						<div className={`border ${theme === 'dark' ? 'border-emerald-500/35 bg-[#05080f] shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_30px_rgba(16,185,129,0.08)]' : 'border-slate-300 bg-white shadow-sm'}`}>
							<div className={`border-b px-5 py-3 ${theme === 'dark' ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-slate-200 bg-slate-100'}`}>
								<h2 className={`text-sm font-bold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-emerald-200' : 'text-slate-700'}`}>Paste Service Key</h2>
							</div>
							<div className="space-y-3 px-5 py-4">
								<p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
									Supporta formato flat e nested con chiave oauth. Dopo il parsing puoi rifinire i campi manualmente.
								</p>
								<textarea
									value={jsonInput}
									onChange={(e) => setJsonInput(e.target.value)}
									placeholder={'{\n  "oauth": {\n    "clientid": "...",\n    "clientsecret": "...",\n    "tokenurl": "...",\n    "url": "..."\n  }\n}'}
									className={`h-40 w-full border px-3 py-3 font-mono text-xs focus:outline-none ${theme === 'dark' ? 'border-emerald-500/40 bg-[#02060d] text-emerald-200 placeholder:text-slate-500 focus:border-emerald-400' : 'border-slate-300 bg-slate-950 text-emerald-200 placeholder:text-slate-400 focus:border-blue-500'}`}
								/>
								<div className="flex justify-end">
									<button
										onClick={handleParseServiceKey}
										disabled={parsing || !jsonInput.trim()}
										className={`border px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${theme === 'dark' ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
									>
										{parsing ? 'Parsing...' : 'Parse and Import'}
									</button>
								</div>
							</div>
						</div>

						<div className={`border ${theme === 'dark' ? 'border-cyan-500/30 bg-[#05080f] shadow-[0_0_0_1px_rgba(34,211,238,0.16),0_0_24px_rgba(34,211,238,0.08)]' : 'border-slate-300 bg-white shadow-sm'}`}>
							<div className={`border-b px-5 py-3 ${theme === 'dark' ? 'border-cyan-500/25 bg-cyan-500/10' : 'border-slate-200 bg-slate-100'}`}>
								<h2 className={`text-sm font-bold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-cyan-100' : 'text-slate-700'}`}>
									{editing ? `Editing ${editing.name}` : 'Manual Tenant Form'}
								</h2>
							</div>
							<form onSubmit={handleSave} className="space-y-4 px-5 py-5">
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									<Field
										label="Display Name"
										theme={theme}
										value={form.name}
										onChange={(v) => setForm((f) => ({ ...f, name: v }))}
										placeholder="e.g. TEST_EU30"
									/>
									<Field
										label="Client ID"
										theme={theme}
										value={form.clientId}
										onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
										placeholder="sb-xxxxxxxx"
									/>
								</div>

								<Field
									label="CPI Base URL"
									theme={theme}
									value={form.baseUrl}
									onChange={(v) => setForm((f) => ({ ...f, baseUrl: v }))}
									placeholder="https://tenant.it-cpi020.cfapps.eu30.hana.ondemand.com"
								/>
								<Field
									label="OAuth Token URL"
									theme={theme}
									value={form.tokenUrl}
									onChange={(v) => setForm((f) => ({ ...f, tokenUrl: v }))}
									placeholder="https://tenant.authentication.eu30.hana.ondemand.com/oauth/token"
								/>
								<Field
									label="Client Secret"
									theme={theme}
									value={form.clientSecret}
									onChange={(v) => setForm((f) => ({ ...f, clientSecret: v }))}
									placeholder="Paste secret"
									type="password"
								/>

								<div className="flex flex-wrap gap-3 pt-2">
									<button
										type="submit"
										disabled={saving}
										className={`border px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${theme === 'dark' ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
									>
										{saving ? 'Saving...' : 'Save Tenant'}
									</button>
									{editing && (
										<button
											type="button"
											onClick={() => {
												setEditing(null);
												setForm(EMPTY_TENANT);
											}}
											className={`border px-5 py-2 text-sm font-semibold ${theme === 'dark' ? 'border-slate-500/60 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
										>
											Cancel
										</button>
									)}
								</div>
							</form>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function Field({
	label,
	theme,
	value,
	onChange,
	placeholder,
	type = 'text',
}: {
	label: string;
	theme: 'dark' | 'light';
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	type?: string;
}) {
	return (
		<div>
			<label className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{label}</label>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={`w-full border px-3 py-2 text-sm focus:outline-none ${theme === 'dark' ? 'border-slate-600 bg-[#0a1220] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500'}`}
			/>
		</div>
	);
}

createRoot(document.getElementById('root')!).render(<Options />);
