// Form to create or edit a Project
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Input, Textarea } from '../../components/FormFields';
import type { Project } from '../../types';

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
  const [referenceUrl, setReferenceUrl] = useState(project?.referenceUrl ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('projectTitle') + ' is required');
      return;
    }
    if (project) {
      updateProject(project.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
        version: version.trim() || 'v1.0.0',
        referenceUrl: referenceUrl.trim() || undefined,
      });
    } else {
      createProject({
        title: title.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
        version: version.trim() || 'v1.0.0',
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
