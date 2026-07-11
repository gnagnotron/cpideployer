import React, { useState } from 'react';
import type { OperationLogEntry } from '../../types';

interface Props {
	theme: 'dark' | 'light';
	entries: OperationLogEntry[];
}

export function OperationLog({ theme, entries }: Props) {
	const [expanded, setExpanded] = useState<string | null>(null);

	if (entries.length === 0) {
		return <div className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} p-4 text-center text-xs`}>No operations logged yet.</div>;
	}

	return (
		<div className={`${theme === 'dark' ? 'divide-cyan-500/20 text-slate-100' : ''} divide-y text-xs`}>
			{entries.map((e) => {
				const ok = e.artifacts.filter((a) => a.status === 'success').length;
				const fail = e.artifacts.filter((a) => a.status === 'error').length;
				const isOpen = expanded === e.id;
				return (
					<div key={e.id} className={`${theme === 'dark' ? 'bg-[#070c14]' : 'bg-white'}`}>
						<button
							onClick={() => setExpanded(isOpen ? null : e.id)}
							className={`${theme === 'dark' ? 'hover:bg-cyan-500/10' : 'hover:bg-gray-50'} w-full text-left px-3 py-2 flex items-center justify-between`}
						>
							<div>
								<span
									className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 ${
										e.operation === 'deploy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
									}`}
								>
									{e.operation}
								</span>
								<span className="font-medium">{e.tenantName}</span>
								<span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'} ml-2`}>
									{new Date(e.timestamp).toLocaleString()}
								</span>
							</div>
							<div className="flex gap-2 items-center">
								{ok > 0 && <span className="text-green-700">✓{ok}</span>}
								{fail > 0 && <span className="text-red-700">✗{fail}</span>}
								<span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`}>{isOpen ? '▲' : '▼'}</span>
							</div>
						</button>
						{isOpen && (
							<ul className={`${theme === 'dark' ? 'bg-[#09101d]' : 'bg-gray-50'} px-4 pb-2 space-y-1`}>
								{e.artifacts.map((a) => (
									<li key={a.id} className={`flex items-start gap-1 ${a.status === 'error' ? 'text-red-700' : 'text-green-700'}`}>
										<span>{a.status === 'success' ? '✓' : '✗'}</span>
										<span className="font-medium">{a.name}</span>
										{a.message && <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} truncate`}>— {a.message}</span>}
									</li>
								))}
							</ul>
						)}
					</div>
				);
			})}
		</div>
	);
}
