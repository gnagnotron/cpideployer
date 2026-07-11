import React, { useState } from 'react';
import type { ArtifactType, PresetGroup, StorageData } from '../../types';
import { sendMessage } from '../../messaging';

interface Props {
	theme: 'dark' | 'light';
	storage: StorageData;
	currentSelection: { id: string; type: ArtifactType }[];
	onApplyPreset: (ids: { id: string; type: ArtifactType }[]) => void;
	onStorageChange: (s: StorageData) => void;
}

export function PresetManager({ theme, storage, currentSelection, onApplyPreset, onStorageChange }: Props) {
	const [newName, setNewName] = useState('');
	const [saving, setSaving] = useState(false);

	async function handleSave() {
		if (!newName.trim() || currentSelection.length === 0) return;
		setSaving(true);
		try {
			const preset: PresetGroup = {
				id: crypto.randomUUID(),
				name: newName.trim(),
				artifactIds: currentSelection,
			};
			const updated = await sendMessage<StorageData>({ type: 'SAVE_PRESET', preset });
			onStorageChange(updated);
			setNewName('');
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		const updated = await sendMessage<StorageData>({ type: 'DELETE_PRESET', presetId: id });
		onStorageChange(updated);
	}

	return (
		<div className="p-3 space-y-4">
			{/* Save current selection as preset */}
			<div>
				<h3 className={`${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'} text-xs font-semibold mb-2`}>Save Current Selection as Preset</h3>
				{currentSelection.length === 0 ? (
					<p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} text-xs`}>No artifacts selected. Go to Artifacts tab and select some.</p>
				) : (
					<div className="flex gap-2 items-center">
						<input
							type="text"
							placeholder="Preset name…"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							className={`${theme === 'dark' ? 'border-cyan-500/30 bg-[#09101d] text-slate-100 placeholder:text-slate-400 focus:ring-cyan-400' : 'border focus:ring-blue-400'} rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-1`}
						/>
						<button
							onClick={handleSave}
							disabled={saving || !newName.trim()}
							className={`${theme === 'dark' ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-100 hover:bg-cyan-500/30' : 'bg-blue-600 text-white hover:bg-blue-700'} text-xs px-3 py-1 rounded disabled:opacity-40`}
						>
							{saving ? '…' : 'Save'}
						</button>
					</div>
				)}
				{currentSelection.length > 0 && (
					<p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} text-[10px] mt-1`}>{currentSelection.length} artifact(s) will be saved.</p>
				)}
			</div>

			{/* Preset list */}
			<div>
				<h3 className={`${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'} text-xs font-semibold mb-2`}>Saved Presets</h3>
				{storage.presets.length === 0 ? (
					<p className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} text-xs`}>No presets saved yet.</p>
				) : (
					<ul className="space-y-2">
						{storage.presets.map((p) => (
							<li key={p.id} className={`${theme === 'dark' ? 'bg-[#09101d] border-cyan-500/20 text-slate-100' : 'bg-white border'} flex items-center justify-between rounded px-3 py-2 shadow-sm`}>
								<div>
									<span className="font-medium text-xs">{p.name}</span>
									<span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} ml-2 text-[10px]`}>{p.artifactIds.length} artifact(s)</span>
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => onApplyPreset(p.artifactIds)}
										className={`${theme === 'dark' ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/30' : 'bg-green-50 text-green-700 hover:bg-green-100'} text-[10px] px-2 py-1 rounded`}
									>
										Apply
									</button>
									<button
										onClick={() => handleDelete(p.id)}
										className={`${theme === 'dark' ? 'bg-rose-500/20 border border-rose-400/60 text-rose-100 hover:bg-rose-500/30' : 'bg-red-50 text-red-700 hover:bg-red-100'} text-[10px] px-2 py-1 rounded`}
									>
										Delete
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
