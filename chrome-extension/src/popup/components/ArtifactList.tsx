import React from 'react';
import type { DesigntimeArtifact, RuntimeArtifact } from '../../types';

const TYPE_BADGE: Record<string, string> = {
	IntegrationFlow: 'bg-blue-100 text-blue-700',
	ValueMapping: 'bg-purple-100 text-purple-700',
	ScriptCollection: 'bg-yellow-100 text-yellow-700',
	MessageMapping: 'bg-teal-100 text-teal-700',
};

const STATUS_BADGE: Record<string, string> = {
	STARTED: 'bg-green-100 text-green-700',
	STARTING: 'bg-yellow-100 text-yellow-700',
	ERROR: 'bg-red-100 text-red-700',
	STOPPING: 'bg-orange-100 text-orange-700',
	STOPPED: 'bg-gray-100 text-gray-600',
};

interface Props {
	theme: 'dark' | 'light';
	artifacts: DesigntimeArtifact[];
	runtime: RuntimeArtifact[];
	selectedIds: Set<string>;
	onSelectionChange: (ids: Set<string>) => void;
}

export function ArtifactList({ theme, artifacts, runtime, selectedIds, onSelectionChange }: Props) {
	const runtimeMap = new Map(runtime.map((r) => [r.Id, r]));

	const allVisible = artifacts.every((a) => selectedIds.has(a.Id));

	function toggleAll() {
		if (allVisible && artifacts.length > 0) {
			const next = new Set(selectedIds);
			artifacts.forEach((a) => next.delete(a.Id));
			onSelectionChange(next);
		} else {
			const next = new Set(selectedIds);
			artifacts.forEach((a) => next.add(a.Id));
			onSelectionChange(next);
		}
	}

	function toggle(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onSelectionChange(next);
	}

	if (artifacts.length === 0) {
		return <div className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} p-4 text-center text-xs`}>No artifacts found.</div>;
	}

	return (
		<table className="w-full text-xs">
			<thead>
				<tr className={`${theme === 'dark' ? 'bg-[#09101d] text-slate-300 border-b border-cyan-500/20' : 'bg-gray-100 text-gray-600'} uppercase text-[10px] tracking-wide`}>
					<th className="px-3 py-2 w-8">
						<input
							type="checkbox"
							checked={allVisible && artifacts.length > 0}
							onChange={toggleAll}
						/>
					</th>
					<th className="px-3 py-2 text-left">Name / ID</th>
					<th className="px-3 py-2 text-left">Type</th>
					<th className="px-3 py-2 text-left">Version</th>
					<th className="px-3 py-2 text-left">Status</th>
				</tr>
			</thead>
			<tbody>
				{artifacts.map((a) => {
					const rt = runtimeMap.get(a.Id);
					const isSelected = selectedIds.has(a.Id);
					return (
						<tr
							key={a.Id}
							onClick={() => toggle(a.Id)}
							className={`cursor-pointer border-b ${theme === 'dark' ? 'border-cyan-500/10 hover:bg-cyan-500/10' : 'hover:bg-blue-50'} ${isSelected ? (theme === 'dark' ? 'bg-cyan-500/15' : 'bg-blue-50') : (theme === 'dark' ? 'bg-[#070c14]' : 'bg-white')}`}
						>
							<td className="px-3 py-2 text-center">
								<input
									type="checkbox"
									checked={isSelected}
									onChange={() => toggle(a.Id)}
									onClick={(e) => e.stopPropagation()}
								/>
							</td>
							<td className="px-3 py-2">
								<div className="font-medium truncate max-w-[200px]" title={a.Name}>{a.Name}</div>
								<div className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} truncate max-w-[200px]`} title={a.Id}>{a.Id}</div>
							</td>
							<td className="px-3 py-2">
								<span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_BADGE[a.Type] ?? 'bg-gray-100 text-gray-600'}`}>
									{a.Type.replace('IntegrationFlow', 'iFlow').replace('ScriptCollection', 'Script').replace('MessageMapping', 'MsgMap').replace('ValueMapping', 'ValMap')}
								</span>
							</td>
							<td className={`px-3 py-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>{a.Version}</td>
							<td className="px-3 py-2">
								{rt ? (
									<span
										className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[rt.Status] ?? 'bg-gray-100 text-gray-600'}`}
										title={rt.ErrorInformation?.LastErrorMessage}
									>
										{rt.Status}
									</span>
								) : (
									<span className={`${theme === 'dark' ? 'text-slate-500' : 'text-gray-300'}`}>—</span>
								)}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
