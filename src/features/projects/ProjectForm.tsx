// Form to create or edit a Project
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Input, Textarea } from '../../components/FormFields';
import { ProjectIcon } from '../../components/ProjectIcon';
import type { Project } from '../../types';
import { isSafeHttpUrl } from '../../services/security';
import { PROJECT_ICONS } from '../../constants/projectIcons';

interface ProjectFormProps {
  project?: Project;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const { t, createProject, updateProject } = useApp();
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [tag, setTag] = useState(project?.tag ?? '');
  const [version, setVersion] = useState(project?.version ?? 'v1.0.0');
  const [icon, setIcon] = useState(project?.icon ?? '');
  const [referenceUrl, setReferenceUrl] = useState(project?.referenceUrl ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('projectTitle') + ' is required');
      return;
    }
    if (referenceUrl.trim() && !isSafeHttpUrl(referenceUrl.trim())) {
      setError('Reference URL must use http:// or https://');
      return;
    }
    if (project) {
      updateProject(project.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
        version: version.trim() || 'v1.0.0',
        icon: icon || undefined,
        referenceUrl: referenceUrl.trim() || undefined,
      });
    } else {
      createProject({
        title: title.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
        version: version.trim() || 'v1.0.0',
        icon: icon || undefined,
        referenceUrl: referenceUrl.trim() || undefined,
      });
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t('projectTitle')}
        hint={t('required')}
        value={title}
        onChange={(e) => { setTitle(e.target.value); setError(''); }}
        placeholder="e.g. User Authentication API"
        autoFocus
        error={error}
      />
      <Textarea
        label={t('projectDescription')}
        hint={t('optional')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this project about?"
        rows={3}
      />
      <Input
        label={t('tag')}
        hint={t('optional')}
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="e.g. Core"
        maxLength={24}
      />
      <Input
        label={t('version')}
        hint={t('optional')}
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        placeholder="v1.0.0"
        maxLength={24}
      />

      {/* Icon picker */}
      <div>
        <label className="block text-xs font-semibold text-[#464554] mb-1.5">
          {t('projectIcon')} <span className="font-normal text-[#777586]">({t('optional')})</span>
        </label>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-3 p-3 rounded-lg border border-[#c7c4d7]/30 bg-[#f7f9fb] max-h-64 overflow-y-auto">
          {/* No icon option */}
          <button
            type="button"
            onClick={() => setIcon('')}
            className={`min-h-[4.5rem] rounded-xl flex items-center justify-center border transition-all ${
              !icon
                ? 'border-[#2a14b4] bg-[#e3dfff] ring-2 ring-[#2a14b4]/20 shadow-sm'
                : 'border-[#c7c4d7]/30 bg-white/80 hover:bg-[#eef2f6] hover:border-[#c7c4d7]/50'
            }`}
            title="No icon"
          >
            <span className="material-symbols-outlined text-xl text-[#777586]">block</span>
          </button>
          {PROJECT_ICONS.map((iconId) => (
            <button
              key={iconId}
              type="button"
              onClick={() => setIcon(iconId)}
              className={`min-h-[4.5rem] rounded-xl flex items-center justify-center border transition-all ${
                icon === iconId
                  ? 'border-[#2a14b4] bg-[#e3dfff] ring-2 ring-[#2a14b4]/20 shadow-sm'
                  : 'border-[#c7c4d7]/30 bg-white/80 hover:bg-[#eef2f6] hover:border-[#c7c4d7]/50'
              }`}
              title={iconId}
            >
              <ProjectIcon
                icon={iconId}
                alt={iconId}
                frameClassName="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#ffffff,#f2f4f6)] p-1 shadow-[inset_0_0_0_1px_rgba(199,196,215,0.18)]"
                imgClassName="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>

      <Input
        label={t('projectReferenceUrl')}
        hint={t('optional')}
        type="url"
        value={referenceUrl}
        onChange={(e) => setReferenceUrl(e.target.value)}
        placeholder="https://docs.example.com"
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
        >
          {project ? t('save') : t('createProject')}
        </button>
      </div>
    </form>
  );
}
