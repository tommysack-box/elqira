// Left sidebar: list of requests in the current scenario — fedele ai mockup Stitch
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import { MethodBadge } from '../../components/MethodBadge';
import { RequestForm } from './RequestForm';
import type { Request } from '../../types';

export function RequestsSidebar() {
  const { t, requests, currentRequest, setCurrentRequest, deleteRequest } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Request | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Request | null>(null);

  return (
    <aside className="w-64 flex flex-col bg-[#f2f4f6] border-r border-[#c7c4d7]/20 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#c7c4d7]/20">
        <span className="font-mono text-[10px] text-[#777586] uppercase tracking-widest font-bold">
          {t('requests')}
        </span>
        <button
          onClick={() => setShowNew(true)}
          className="material-symbols-outlined text-[#777586] hover:text-[#2a14b4] p-1.5 rounded hover:bg-[#e3dfff]/40 transition-colors text-xl"
          title={t('newRequest')}
        >
          add
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <span className="material-symbols-outlined text-3xl text-[#c7c4d7] mb-3">
              terminal
            </span>
            <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">
              {t('noRequests')}
            </p>
          </div>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              onClick={() => setCurrentRequest(r)}
              className={`group flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-l-2 transition-all ${
                currentRequest?.id === r.id
                  ? 'bg-[#e3dfff]/40 border-l-[#2a14b4]'
                  : 'border-l-transparent hover:bg-[#e6e8ea]/50'
              }`}
            >
              <MethodBadge method={r.method} size="sm" />
              <span
                className={`flex-1 text-xs truncate font-medium ${
                  currentRequest?.id === r.id ? 'text-[#2a14b4]' : 'text-[#464554]'
                }`}
              >
                {r.title}
              </span>
              {/* Actions */}
              <div
                className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setEditing(r)}
                  className="material-symbols-outlined text-sm text-[#777586] hover:text-[#2a14b4] p-1 rounded hover:bg-[#e3dfff]/40 transition-colors"
                >
                  edit
                </button>
                <button
                  onClick={() => setConfirmDelete(r)}
                  className="material-symbols-outlined text-sm text-[#777586] hover:text-[#ba1a1a] p-1 rounded hover:bg-[#ffdad6]/40 transition-colors"
                >
                  delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {showNew && (
        <Modal title={t('newRequest')} onClose={() => setShowNew(false)}>
          <RequestForm onClose={() => setShowNew(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={t('editRequest')} onClose={() => setEditing(null)}>
          <RequestForm request={editing} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={t('deleteRequest')} onClose={() => setConfirmDelete(null)} size="sm">
          <p className="text-sm text-[#464554] mb-6">
            {t('confirmDelete')} <strong>{confirmDelete.title}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-sm rounded-lg border border-[#c7c4d7]/30 text-[#464554] hover:bg-[#f2f4f6] transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => { deleteRequest(confirmDelete.id); setConfirmDelete(null); }}
              className="px-4 py-2 text-sm rounded-lg bg-[#ba1a1a] text-white hover:opacity-90 transition-opacity"
            >
              {t('delete')}
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
