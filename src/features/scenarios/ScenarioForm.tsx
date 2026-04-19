// Form to create or edit a Scenario
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Input, Textarea } from '../../components/FormFields';
import type { Scenario } from '../../types';

interface ScenarioFormProps {
  scenario?: Scenario;
  onClose: () => void;
}

export function ScenarioForm({ scenario, onClose }: ScenarioFormProps) {
  const { t, currentProject, createScenario, updateScenario } = useApp();
  const [title, setTitle] = useState(scenario?.title ?? '');
  const [description, setDescription] = useState(scenario?.description ?? '');
  const [tag, setTag] = useState(scenario?.tag ?? '');
  const [version, setVersion] = useState(scenario?.version ?? 'v1.0.0');
  const [referenceUrl, setReferenceUrl] = useState(scenario?.referenceUrl ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (scenario) {
      updateScenario(scenario.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
        version: version.trim() || 'v1.0.0',
        referenceUrl: referenceUrl.trim() || undefined,
      });
    } else if (currentProject) {
      createScenario({
        projectId: currentProject.id,
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
        label={t('scenarioTitle')}
        hint={t('required')}
        value={title}
        onChange={(e) => { setTitle(e.target.value); setError(''); }}
        placeholder="e.g. User Authentication"
        autoFocus
        error={error}
      />
      <Textarea
        label={t('scenarioDescription')}
        hint={t('optional')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What does this scenario cover?"
        rows={3}
      />
      <Input
        label={t('tag')}
        hint={t('optional')}
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="e.g. Auth"
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
        label={t('scenarioReferenceUrl')}
        hint={t('optional')}
        type="url"
        value={referenceUrl}
        onChange={(e) => setReferenceUrl(e.target.value)}
        placeholder="https://docs.example.com"
      />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#c7c4d7]/30 text-[#464554] hover:bg-[#f2f4f6] transition-colors">
          {t('cancel')}
        </button>
        <button type="submit" className="px-5 py-2 text-sm rounded-lg bg-[#2a14b4] text-white hover:opacity-90 transition-opacity font-semibold shadow-sm">
          {scenario ? t('save') : t('createScenario')}
        </button>
      </div>
    </form>
  );
}
