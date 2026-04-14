// Form to create or edit a Request (title, description, method, url)
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Input, Textarea, Select } from '../../components/FormFields';
import type { Request, HttpMethod } from '../../types';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface RequestFormProps {
  request?: Request;
  onClose: () => void;
}

export function RequestForm({ request, onClose }: RequestFormProps) {
  const { t, currentScenario, createRequest, updateRequest } = useApp();
  const [title, setTitle] = useState(request?.title ?? '');
  const [description, setDescription] = useState(request?.description ?? '');
  const [method, setMethod] = useState<HttpMethod>(request?.method ?? 'GET');
  const [url, setUrl] = useState(request?.url ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (request) {
      updateRequest(request.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        method,
        url: url.trim(),
      });
    } else if (currentScenario) {
      createRequest({
        scenarioId: currentScenario.id,
        title: title.trim(),
        description: description.trim() || undefined,
        method,
        url: url.trim(),
        headers: [],
        body: '',
        notes: '',
      });
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t('requestTitle')}
        hint={t('required')}
        value={title}
        onChange={(e) => { setTitle(e.target.value); setError(''); }}
        placeholder="e.g. Login"
        autoFocus
        error={error}
      />
      <Textarea
        label={t('requestDescription')}
        hint={t('optional')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What does this request do?"
        rows={2}
      />
      <div className="flex gap-3">
        <div className="w-36">
          <Select label={t('requestMethod')} value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}>
            {HTTP_METHODS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            label={t('requestUrl')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[#c7c4d7]/30 text-[#464554] hover:bg-[#f2f4f6] transition-colors">
          {t('cancel')}
        </button>
        <button type="submit" className="px-5 py-2 text-sm rounded-lg bg-[#2a14b4] text-white hover:opacity-90 transition-opacity font-semibold shadow-sm">
          {request ? t('save') : t('createRequest')}
        </button>
      </div>
    </form>
  );
}
