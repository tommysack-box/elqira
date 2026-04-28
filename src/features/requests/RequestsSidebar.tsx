// Left sidebar: list of requests in the current scenario — fedele ai mockup Stitch
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/Modal';
import { MethodBadge } from '../../components/MethodBadge';
import { RequestForm } from './RequestForm';
import type { Request } from '../../types';

export function RequestsSidebar() {
  const { t, requests, draftRequest, currentRequest, setCurrentRequest, deleteRequest, reorderRequests } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Request | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Request | null>(null);
  const [draggedRequestId, setDraggedRequestId] = useState<string | null>(null);
  const [dropTargetRequestId, setDropTargetRequestId] = useState<string | null>(null);
  const [hoveredDescription, setHoveredDescription] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const visibleRequests = draftRequest ? [draftRequest, ...requests] : requests;

  const showDescriptionTooltip = (element: HTMLDivElement, text: string) => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 288;
    const viewportPadding = 16;
    const preferredLeft = rect.right + 14;
    const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;

    setHoveredDescription({
      text,
      top: rect.top + rect.height / 2,
      left: Math.max(viewportPadding, Math.min(preferredLeft, maxLeft)),
    });
  };

  const handleDropRequest = (targetRequestId: string) => {
    if (!draggedRequestId || draggedRequestId === targetRequestId) {
      setDraggedRequestId(null);
      setDropTargetRequestId(null);
      return;
    }

    const orderedIds = requests.map((request) => request.id);
    const draggedIndex = orderedIds.indexOf(draggedRequestId);
    const targetIndex = orderedIds.indexOf(targetRequestId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedRequestId(null);
      setDropTargetRequestId(null);
      return;
    }

    const [movedRequestId] = orderedIds.splice(draggedIndex, 1);
    orderedIds.splice(targetIndex, 0, movedRequestId);
    reorderRequests(orderedIds);
    setDraggedRequestId(null);
    setDropTargetRequestId(null);
  };

  return (
    <>
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
          {visibleRequests.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="material-symbols-outlined text-3xl text-[#c7c4d7] mb-3">
                terminal
              </span>
              <p className="font-mono text-[10px] text-[#777586] uppercase tracking-widest">
                {t('noRequests')}
              </p>
            </div>
          ) : (
            visibleRequests.map((r) => {
              const description = r.description?.trim();

              return (
                <div
                  key={r.id}
                  draggable={!r.isDraft}
                  onMouseEnter={(e) => {
                    if (!description) return;
                    showDescriptionTooltip(e.currentTarget, description);
                  }}
                  onMouseMove={(e) => {
                    if (!description) return;
                    showDescriptionTooltip(e.currentTarget, description);
                  }}
                  onMouseLeave={() => setHoveredDescription(null)}
                  onDragStart={() => {
                    if (r.isDraft) return;
                    setDraggedRequestId(r.id);
                    setDropTargetRequestId(r.id);
                    setHoveredDescription(null);
                  }}
                  onDragOver={(e) => {
                    if (!draggedRequestId || r.isDraft || draggedRequestId === r.id) return;
                    e.preventDefault();
                    setDropTargetRequestId(r.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (r.isDraft) return;
                    handleDropRequest(r.id);
                  }}
                  onDragEnd={() => {
                    setDraggedRequestId(null);
                    setDropTargetRequestId(null);
                  }}
                  onClick={() => setCurrentRequest(r)}
                  className={`group flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-l-2 transition-all ${
                    currentRequest?.id === r.id
                      ? 'bg-[#e3dfff]/40 border-l-[#2a14b4]'
                      : 'border-l-transparent hover:bg-[#e6e8ea]/50'
                  } ${!r.isDraft ? 'active:cursor-grabbing' : ''} ${
                    dropTargetRequestId === r.id && draggedRequestId !== r.id
                      ? 'border-t-2 border-t-[#2a14b4]'
                      : ''
                  } ${draggedRequestId === r.id ? 'opacity-60' : ''}`}
                >
                  <MethodBadge method={r.method} size="xs" />
                  <span
                    className={`flex-1 min-w-0 text-xs truncate font-medium ${
                      currentRequest?.id === r.id ? 'text-[#2a14b4]' : 'text-[#464554]'
                    }`}
                  >
                    {r.title}
                  </span>
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
              );
            })
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

      {hoveredDescription && (
        <div
          className="pointer-events-none fixed z-50 w-72"
          style={{ top: hoveredDescription.top, left: hoveredDescription.left, transform: 'translateY(-50%)' }}
        >
          <div className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] bg-[#191c1e] shadow-[0_12px_32px_rgba(25,28,30,0.18)]" />
          <div className="relative rounded-2xl border border-[#2a14b4]/15 bg-[#191c1e] px-4 py-3 text-[11px] leading-relaxed text-white shadow-[0_18px_40px_rgba(25,28,30,0.22)] backdrop-blur-sm">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em] text-[#c7bcff]">
              Description
            </div>
            <p className="whitespace-pre-wrap break-words text-[#f7f9fb]">
              {hoveredDescription.text}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
