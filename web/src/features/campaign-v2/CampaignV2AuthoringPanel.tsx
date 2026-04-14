'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { Button, Select } from '@/components/ui';
import type { Effect, Event, LocationState } from '@/generated/campaign-v2';
import type { CampaignV2AuthoringAction } from '@/server/campaign-v2';

import { runCampaignV2AuthoringAction } from './api';
import styles from './CampaignV2Inspector.module.css';
import type { CampaignV2InspectorPayload } from './types';

type CampaignV2AuthoringPanelProps = {
  payload: CampaignV2InspectorPayload;
  onPayloadChange(nextPayload: CampaignV2InspectorPayload): void;
};

type LocationFormState = {
  title: string;
  summary: string;
  tagsText: string;
  parentLocationId: string;
};

type LocationStateFormState = {
  stage: 'initial' | 'post-major-visit';
  title: string;
  summary: string;
  status: string;
  notes: string;
};

type SessionFormState = {
  title: string;
  summary: string;
  notes: string;
  startingLocationStateId: string;
  resultingLocationStateId: string;
  followsSessionId: string;
};

type EventFormState = {
  title: string;
  summary: string;
  status: string;
  notes: string;
  eventType: string;
  sessionId: string;
  threadId: string;
};

type EffectFormState = {
  title: string;
  summary: string;
  status: string;
  notes: string;
  effectType: string;
  scope: string;
  severity: string;
  modifierEffectId: string;
};

const LOCATION_STATE_STATUSES = ['draft', 'available', 'active', 'resolved', 'archived'] as const;
const EVENT_STATUSES = ['locked', 'available', 'active', 'resolved', 'missed', 'archived'] as const;
const EFFECT_STATUSES = ['active', 'inactive', 'resolved', 'archived'] as const;
const EFFECT_SCOPES = ['', 'local', 'subtree', 'city'] as const;
const EFFECT_SEVERITIES = ['', 'low', 'medium', 'high', 'critical'] as const;

function parseTags(value: string) {
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function joinTags(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)).join(', ');
}

function humanize(value: string) {
  if (!value) {
    return 'None';
  }

  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toSelectValue(value: string | null | undefined) {
  return value ?? '';
}

export function CampaignV2AuthoringPanel({ payload, onPayloadChange }: CampaignV2AuthoringPanelProps) {
  const authoring = payload.authoring;
  const projectId = payload.project?.id ?? '';

  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [mutationMessage, setMutationMessage] = useState('');
  const [mutationError, setMutationError] = useState('');

  const [locationMode, setLocationMode] = useState<'create' | 'edit'>('create');
  const [editingLocationId, setEditingLocationId] = useState('');
  const [locationForm, setLocationForm] = useState<LocationFormState>({
    title: '',
    summary: '',
    tagsText: '',
    parentLocationId: '',
  });

  const [locationStateMode, setLocationStateMode] = useState<'create' | 'edit'>('create');
  const [editingLocationStateId, setEditingLocationStateId] = useState('');
  const [locationStateForm, setLocationStateForm] = useState<LocationStateFormState>({
    stage: 'initial',
    title: '',
    summary: '',
    status: 'available',
    notes: '',
  });

  const [sessionMode, setSessionMode] = useState<'create' | 'edit'>('create');
  const [editingSessionId, setEditingSessionId] = useState('');
  const [sessionForm, setSessionForm] = useState<SessionFormState>({
    title: '',
    summary: '',
    notes: '',
    startingLocationStateId: '',
    resultingLocationStateId: '',
    followsSessionId: '',
  });

  const [eventMode, setEventMode] = useState<'create' | 'edit'>('create');
  const [editingEventId, setEditingEventId] = useState('');
  const [eventForm, setEventForm] = useState<EventFormState>({
    title: '',
    summary: '',
    status: 'active',
    notes: '',
    eventType: '',
    sessionId: '',
    threadId: '',
  });

  const [effectMode, setEffectMode] = useState<'create' | 'edit'>('create');
  const [editingEffectId, setEditingEffectId] = useState('');
  const [effectForm, setEffectForm] = useState<EffectFormState>({
    title: '',
    summary: '',
    status: 'active',
    notes: '',
    effectType: '',
    scope: 'local',
    severity: 'medium',
    modifierEffectId: '',
  });

  const locationDraftsById = useMemo(
    () => new Map((authoring?.locationDrafts ?? []).map((draft) => [draft.id, draft])),
    [authoring?.locationDrafts],
  );
  const locationStateDraftsById = useMemo(
    () => new Map((authoring?.locationStateDrafts ?? []).map((draft) => [draft.id, draft])),
    [authoring?.locationStateDrafts],
  );
  const sessionDraftsById = useMemo(
    () => new Map((authoring?.sessionDrafts ?? []).map((draft) => [draft.id, draft])),
    [authoring?.sessionDrafts],
  );
  const eventDraftsById = useMemo(
    () => new Map((authoring?.eventDrafts ?? []).map((draft) => [draft.id, draft])),
    [authoring?.eventDrafts],
  );
  const effectDraftsById = useMemo(
    () => new Map((authoring?.effectDrafts ?? []).map((draft) => [draft.id, draft])),
    [authoring?.effectDrafts],
  );

  useEffect(() => {
    setMutationError('');
    setMutationMessage('');
  }, [authoring?.selectedLocationId, projectId]);

  useEffect(() => {
    if (mutationError || mutationMessage) {
      setExpanded(true);
    }
  }, [mutationError, mutationMessage]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    setEditingLocationId(authoring.selectedLocationId ?? authoring.locationDrafts[0]?.id ?? '');
    setLocationForm({
      title: authoring.defaults.location.title,
      summary: authoring.defaults.location.summary,
      tagsText: authoring.defaults.location.tagsText,
      parentLocationId: toSelectValue(authoring.defaults.location.parentLocationId),
    });
  }, [authoring]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    if (locationMode === 'edit') {
      const draft =
        locationDraftsById.get(editingLocationId) ??
        (authoring.selectedLocationId ? locationDraftsById.get(authoring.selectedLocationId) : undefined);
      if (!draft) {
        return;
      }

      setLocationForm({
        title: draft.title,
        summary: draft.summary,
        tagsText: joinTags(draft.tags),
        parentLocationId: toSelectValue(draft.parentLocationId),
      });
      return;
    }

    setLocationForm({
      title: authoring.defaults.location.title,
      summary: authoring.defaults.location.summary,
      tagsText: authoring.defaults.location.tagsText,
      parentLocationId: toSelectValue(authoring.defaults.location.parentLocationId),
    });
  }, [authoring, editingLocationId, locationDraftsById, locationMode]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    setEditingLocationStateId(authoring.locationStateDrafts[0]?.id ?? '');
    setLocationStateForm({
      stage: authoring.defaults.locationState.stage,
      title: authoring.defaults.locationState.title,
      summary: authoring.defaults.locationState.summary,
      status: authoring.defaults.locationState.status,
      notes: authoring.defaults.locationState.notes,
    });
  }, [authoring]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    if (locationStateMode === 'edit') {
      const draft = locationStateDraftsById.get(editingLocationStateId);
      if (!draft) {
        return;
      }

      setLocationStateForm({
        stage: draft.id.endsWith('post-major-visit') ? 'post-major-visit' : 'initial',
        title: draft.title,
        summary: draft.summary,
        status: draft.status,
        notes: draft.notes,
      });
      return;
    }

    setLocationStateForm({
      stage: authoring.defaults.locationState.stage,
      title: authoring.defaults.locationState.title,
      summary: authoring.defaults.locationState.summary,
      status: authoring.defaults.locationState.status,
      notes: authoring.defaults.locationState.notes,
    });
  }, [authoring, editingLocationStateId, locationStateDraftsById, locationStateMode]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    setEditingSessionId(authoring.sessionDrafts[0]?.id ?? '');
    setSessionForm({
      title: authoring.defaults.session.title,
      summary: authoring.defaults.session.summary,
      notes: authoring.defaults.session.notes,
      startingLocationStateId: toSelectValue(authoring.defaults.session.startingLocationStateId),
      resultingLocationStateId: toSelectValue(authoring.defaults.session.resultingLocationStateId),
      followsSessionId: toSelectValue(authoring.defaults.session.followsSessionId),
    });
  }, [authoring]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    if (sessionMode === 'edit') {
      const draft = sessionDraftsById.get(editingSessionId);
      if (!draft) {
        return;
      }

      setSessionForm({
        title: draft.title,
        summary: draft.summary,
        notes: draft.notes,
        startingLocationStateId: toSelectValue(draft.startingLocationStateId),
        resultingLocationStateId: toSelectValue(draft.resultingLocationStateId),
        followsSessionId: toSelectValue(draft.followsSessionId),
      });
      return;
    }

    setSessionForm({
      title: authoring.defaults.session.title,
      summary: authoring.defaults.session.summary,
      notes: authoring.defaults.session.notes,
      startingLocationStateId: toSelectValue(authoring.defaults.session.startingLocationStateId),
      resultingLocationStateId: toSelectValue(authoring.defaults.session.resultingLocationStateId),
      followsSessionId: toSelectValue(authoring.defaults.session.followsSessionId),
    });
  }, [authoring, editingSessionId, sessionDraftsById, sessionMode]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    setEditingEventId(authoring.eventDrafts[0]?.id ?? '');
    setEventForm({
      title: authoring.defaults.event.title,
      summary: authoring.defaults.event.summary,
      status: authoring.defaults.event.status,
      notes: authoring.defaults.event.notes,
      eventType: authoring.defaults.event.eventType,
      sessionId: toSelectValue(authoring.defaults.event.sessionId),
      threadId: authoring.defaults.event.threadId,
    });
  }, [authoring]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    if (eventMode === 'edit') {
      const draft = eventDraftsById.get(editingEventId);
      if (!draft) {
        return;
      }

      setEventForm({
        title: draft.title,
        summary: draft.summary,
        status: draft.status,
        notes: draft.notes,
        eventType: draft.eventType,
        sessionId: toSelectValue(draft.sessionId),
        threadId: draft.threadId,
      });
      return;
    }

    setEventForm({
      title: authoring.defaults.event.title,
      summary: authoring.defaults.event.summary,
      status: authoring.defaults.event.status,
      notes: authoring.defaults.event.notes,
      eventType: authoring.defaults.event.eventType,
      sessionId: toSelectValue(authoring.defaults.event.sessionId),
      threadId: authoring.defaults.event.threadId,
    });
  }, [authoring, editingEventId, eventDraftsById, eventMode]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    setEditingEffectId(authoring.effectDrafts[0]?.id ?? '');
    setEffectForm({
      title: authoring.defaults.effect.title,
      summary: authoring.defaults.effect.summary,
      status: authoring.defaults.effect.status,
      notes: authoring.defaults.effect.notes,
      effectType: authoring.defaults.effect.effectType,
      scope: toSelectValue(authoring.defaults.effect.scope),
      severity: toSelectValue(authoring.defaults.effect.severity),
      modifierEffectId: toSelectValue(authoring.defaults.effect.modifierEffectId),
    });
  }, [authoring]);

  useEffect(() => {
    if (!authoring) {
      return;
    }

    if (effectMode === 'edit') {
      const draft = effectDraftsById.get(editingEffectId);
      if (!draft) {
        return;
      }

      setEffectForm({
        title: draft.title,
        summary: draft.summary,
        status: draft.status,
        notes: draft.notes,
        effectType: draft.effectType,
        scope: toSelectValue(draft.scope),
        severity: toSelectValue(draft.severity),
        modifierEffectId: toSelectValue(draft.modifierEffectId),
      });
      return;
    }

    setEffectForm({
      title: authoring.defaults.effect.title,
      summary: authoring.defaults.effect.summary,
      status: authoring.defaults.effect.status,
      notes: authoring.defaults.effect.notes,
      effectType: authoring.defaults.effect.effectType,
      scope: toSelectValue(authoring.defaults.effect.scope),
      severity: toSelectValue(authoring.defaults.effect.severity),
      modifierEffectId: toSelectValue(authoring.defaults.effect.modifierEffectId),
    });
  }, [authoring, editingEffectId, effectDraftsById, effectMode]);

  async function runAction(input: CampaignV2AuthoringAction) {
    if (!projectId || pending) {
      return;
    }

    setPending(true);
    setMutationError('');
    setMutationMessage('');

    try {
      const response = await runCampaignV2AuthoringAction(projectId, input);
      onPayloadChange(response.payload);
      setMutationMessage(response.result.message);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to save the v2 authoring change.');
    } finally {
      setPending(false);
    }
  }

  if (!authoring) {
    return null;
  }

  const selectedLocationId = authoring.selectedLocationId;

  return (
    <section className={`${styles.card} ${styles.authoringCard}`}>
      <div className={styles.authoringCardHeader}>
        <div className={styles.authoringCardTitleBlock}>
          <h3>Guided V2 Authoring</h3>
          <p className={styles.subtle}>
            Optional creation tools for {authoring.selectedLocationTitle ?? 'the selected location'}.
          </p>
        </div>
        <Button
          variant="ghost"
          aria-controls="campaign-v2-authoring-body"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Hide authoring' : 'Open authoring'}
        </Button>
      </div>

      {!expanded ? (
        <p className={styles.authoringCollapsedNote}>
          Keep the main page focused on GM reading and prep, then open authoring when you want to create or edit v2 content.
        </p>
      ) : null}

      {expanded ? (
        <div id="campaign-v2-authoring-body" className={styles.authoringBody}>
          {authoring.readOnly ? (
            <div className={styles.empty}>{authoring.readOnlyReason}</div>
          ) : (
            <div className={styles.stack}>
          {mutationError ? (
            <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">
              {mutationError}
            </div>
          ) : null}

          {mutationMessage ? (
            <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
              {mutationMessage}
            </div>
          ) : null}

          <section className={styles.authoringSection}>
            <div className={styles.authoringHeader}>
              <strong>Location</strong>
              <Select value={locationMode} onChange={(event) => setLocationMode(event.target.value as 'create' | 'edit')}>
                <option value="create">Create child location</option>
                <option value="edit">Edit location</option>
              </Select>
            </div>

            {locationMode === 'edit' ? (
              <label className={styles.field}>
                <span>Location</span>
                <Select value={editingLocationId} onChange={(event) => setEditingLocationId(event.target.value)}>
                  {authoring.locationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  aria-label="author location title"
                  className={styles.textInput}
                  value={locationForm.title}
                  onChange={(event) => setLocationForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  aria-label="author location summary"
                  className={styles.textArea}
                  rows={3}
                  value={locationForm.summary}
                  onChange={(event) => setLocationForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Tags</span>
                <input
                  aria-label="author location tags"
                  className={styles.textInput}
                  value={locationForm.tagsText}
                  onChange={(event) => setLocationForm((current) => ({ ...current, tagsText: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Parent</span>
                <Select
                  aria-label="author location parent"
                  value={locationForm.parentLocationId}
                  onChange={(event) => setLocationForm((current) => ({ ...current, parentLocationId: event.target.value }))}
                >
                  <option value="">No parent</option>
                  {authoring.parentLocationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>

              <div className={styles.buttonRow}>
                <Button
                  onClick={() =>
                    void runAction({
                      action: 'upsertLocation',
                      locationId: locationMode === 'edit' ? editingLocationId : null,
                      title: locationForm.title,
                      summary: locationForm.summary,
                      tags: parseTags(locationForm.tagsText),
                      parentLocationId: locationForm.parentLocationId || null,
                    })
                  }
                  disabled={pending || locationForm.title.trim().length === 0 || locationForm.summary.trim().length === 0}
                >
                  {pending ? 'Saving...' : locationMode === 'edit' ? 'Save location' : 'Create location'}
                </Button>
              </div>
            </div>
          </section>

          <section className={styles.authoringSection}>
            <div className={styles.authoringHeader}>
              <strong>Location State</strong>
              <Select
                value={locationStateMode}
                onChange={(event) => setLocationStateMode(event.target.value as 'create' | 'edit')}
              >
                <option value="create">Create from selected location</option>
                <option value="edit">Edit nearby state</option>
              </Select>
            </div>

            {locationStateMode === 'edit' ? (
              <label className={styles.field}>
                <span>Location state</span>
                <Select value={editingLocationStateId} onChange={(event) => setEditingLocationStateId(event.target.value)}>
                  {authoring.locationStateOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <label className={styles.field}>
                <span>Stage</span>
                <Select
                  aria-label="author location state stage"
                  value={locationStateForm.stage}
                  onChange={(event) =>
                    setLocationStateForm((current) => ({
                      ...current,
                      stage: event.target.value as 'initial' | 'post-major-visit',
                    }))
                  }
                >
                  <option value="initial">Initial state</option>
                  <option value="post-major-visit">Post-major-visit state</option>
                </Select>
              </label>
            )}

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  aria-label="author location state title"
                  className={styles.textInput}
                  value={locationStateForm.title}
                  onChange={(event) => setLocationStateForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  aria-label="author location state summary"
                  className={styles.textArea}
                  rows={3}
                  value={locationStateForm.summary}
                  onChange={(event) => setLocationStateForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Status</span>
                <Select
                  aria-label="author location state status"
                  value={locationStateForm.status}
                  onChange={(event) => setLocationStateForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {LOCATION_STATE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  aria-label="author location state notes"
                  className={styles.textArea}
                  rows={3}
                  value={locationStateForm.notes}
                  onChange={(event) => setLocationStateForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <div className={styles.buttonRow}>
                <Button
                  onClick={() =>
                    void runAction({
                      action: 'upsertLocationState',
                      locationStateId: locationStateMode === 'edit' ? editingLocationStateId : null,
                      locationId: selectedLocationId as string,
                      stage: locationStateMode === 'create' ? locationStateForm.stage : null,
                      title: locationStateForm.title,
                      summary: locationStateForm.summary,
                      status: locationStateForm.status as LocationState['status'],
                      notes: locationStateForm.notes,
                    })
                  }
                  disabled={
                    pending ||
                    !selectedLocationId ||
                    locationStateForm.title.trim().length === 0 ||
                    locationStateForm.summary.trim().length === 0
                  }
                >
                  {pending ? 'Saving...' : locationStateMode === 'edit' ? 'Save location state' : 'Create location state'}
                </Button>
              </div>
            </div>
          </section>

          <section className={styles.authoringSection}>
            <div className={styles.authoringHeader}>
              <strong>Session</strong>
              <Select value={sessionMode} onChange={(event) => setSessionMode(event.target.value as 'create' | 'edit')}>
                <option value="create">Create from selected location</option>
                <option value="edit">Edit nearby session</option>
              </Select>
            </div>

            {sessionMode === 'edit' ? (
              <label className={styles.field}>
                <span>Session</span>
                <Select value={editingSessionId} onChange={(event) => setEditingSessionId(event.target.value)}>
                  {authoring.sessionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  aria-label="author session title"
                  className={styles.textInput}
                  value={sessionForm.title}
                  onChange={(event) => setSessionForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  aria-label="author session summary"
                  className={styles.textArea}
                  rows={3}
                  value={sessionForm.summary}
                  onChange={(event) => setSessionForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  aria-label="author session notes"
                  className={styles.textArea}
                  rows={3}
                  value={sessionForm.notes}
                  onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Starting state</span>
                <Select
                  aria-label="author session starting state"
                  value={sessionForm.startingLocationStateId}
                  onChange={(event) => setSessionForm((current) => ({ ...current, startingLocationStateId: event.target.value }))}
                >
                  <option value="">None</option>
                  {authoring.locationStateOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Resulting state</span>
                <Select
                  aria-label="author session resulting state"
                  value={sessionForm.resultingLocationStateId}
                  onChange={(event) => setSessionForm((current) => ({ ...current, resultingLocationStateId: event.target.value }))}
                >
                  <option value="">None</option>
                  {authoring.locationStateOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Follows session</span>
                <Select
                  aria-label="author session follows"
                  value={sessionForm.followsSessionId}
                  onChange={(event) => setSessionForm((current) => ({ ...current, followsSessionId: event.target.value }))}
                >
                  <option value="">None</option>
                  {authoring.followsSessionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>

              <div className={styles.buttonRow}>
                <Button
                  onClick={() =>
                    void runAction({
                      action: 'upsertSession',
                      sessionId: sessionMode === 'edit' ? editingSessionId : null,
                      locationId: selectedLocationId as string,
                      title: sessionForm.title,
                      summary: sessionForm.summary,
                      notes: sessionForm.notes,
                      startingLocationStateId: sessionForm.startingLocationStateId || null,
                      resultingLocationStateId: sessionForm.resultingLocationStateId || null,
                      followsSessionId: sessionForm.followsSessionId || null,
                    })
                  }
                  disabled={pending || !selectedLocationId || sessionForm.title.trim().length === 0 || sessionForm.summary.trim().length === 0}
                >
                  {pending ? 'Saving...' : sessionMode === 'edit' ? 'Save session' : 'Create session'}
                </Button>
              </div>
            </div>
          </section>

          <section className={styles.authoringSection}>
            <div className={styles.authoringHeader}>
              <strong>Event</strong>
              <Select value={eventMode} onChange={(event) => setEventMode(event.target.value as 'create' | 'edit')}>
                <option value="create">Create from current context</option>
                <option value="edit">Edit nearby event</option>
              </Select>
            </div>

            {eventMode === 'edit' ? (
              <label className={styles.field}>
                <span>Event</span>
                <Select value={editingEventId} onChange={(event) => setEditingEventId(event.target.value)}>
                  {authoring.eventOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  aria-label="author event title"
                  className={styles.textInput}
                  value={eventForm.title}
                  onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  aria-label="author event summary"
                  className={styles.textArea}
                  rows={3}
                  value={eventForm.summary}
                  onChange={(event) => setEventForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Status</span>
                <Select
                  aria-label="author event status"
                  value={eventForm.status}
                  onChange={(event) => setEventForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Event type</span>
                <input
                  aria-label="author event type"
                  className={styles.textInput}
                  value={eventForm.eventType}
                  onChange={(event) => setEventForm((current) => ({ ...current, eventType: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Session link</span>
                <Select
                  aria-label="author event session"
                  value={eventForm.sessionId}
                  onChange={(event) => setEventForm((current) => ({ ...current, sessionId: event.target.value }))}
                >
                  <option value="">Selected location only</option>
                  {authoring.sessionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Thread id</span>
                <input
                  aria-label="author event thread"
                  className={styles.textInput}
                  value={eventForm.threadId}
                  onChange={(event) => setEventForm((current) => ({ ...current, threadId: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  aria-label="author event notes"
                  className={styles.textArea}
                  rows={3}
                  value={eventForm.notes}
                  onChange={(event) => setEventForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <div className={styles.buttonRow}>
                <Button
                  onClick={() =>
                    void runAction({
                      action: 'upsertEvent',
                      eventId: eventMode === 'edit' ? editingEventId : null,
                      locationId: selectedLocationId,
                      sessionId: eventForm.sessionId || null,
                      title: eventForm.title,
                      summary: eventForm.summary,
                      status: eventForm.status as Event['status'],
                      notes: eventForm.notes,
                      eventType: eventForm.eventType,
                      threadId: eventForm.threadId || null,
                    })
                  }
                  disabled={pending || !selectedLocationId || eventForm.title.trim().length === 0 || eventForm.summary.trim().length === 0}
                >
                  {pending ? 'Saving...' : eventMode === 'edit' ? 'Save event' : 'Create event'}
                </Button>
              </div>
            </div>
          </section>

          <section className={styles.authoringSection}>
            <div className={styles.authoringHeader}>
              <strong>Effect</strong>
              <Select value={effectMode} onChange={(event) => setEffectMode(event.target.value as 'create' | 'edit')}>
                <option value="create">Create from current context</option>
                <option value="edit">Edit nearby effect</option>
              </Select>
            </div>

            {effectMode === 'edit' ? (
              <label className={styles.field}>
                <span>Effect</span>
                <Select value={editingEffectId} onChange={(event) => setEditingEffectId(event.target.value)}>
                  {authoring.effectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  aria-label="author effect title"
                  className={styles.textInput}
                  value={effectForm.title}
                  onChange={(event) => setEffectForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  aria-label="author effect summary"
                  className={styles.textArea}
                  rows={3}
                  value={effectForm.summary}
                  onChange={(event) => setEffectForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Status</span>
                <Select
                  aria-label="author effect status"
                  value={effectForm.status}
                  onChange={(event) => setEffectForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {EFFECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Effect type</span>
                <input
                  aria-label="author effect type"
                  className={styles.textInput}
                  value={effectForm.effectType}
                  onChange={(event) => setEffectForm((current) => ({ ...current, effectType: event.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span>Scope</span>
                <Select
                  aria-label="author effect scope"
                  value={effectForm.scope}
                  onChange={(event) => setEffectForm((current) => ({ ...current, scope: event.target.value }))}
                >
                  {EFFECT_SCOPES.map((scope) => (
                    <option key={scope || 'none'} value={scope}>
                      {humanize(scope)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Severity</span>
                <Select
                  aria-label="author effect severity"
                  value={effectForm.severity}
                  onChange={(event) => setEffectForm((current) => ({ ...current, severity: event.target.value }))}
                >
                  {EFFECT_SEVERITIES.map((severity) => (
                    <option key={severity || 'none'} value={severity}>
                      {humanize(severity)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Modifies effect</span>
                <Select
                  aria-label="author effect modifier target"
                  value={effectForm.modifierEffectId}
                  onChange={(event) => setEffectForm((current) => ({ ...current, modifierEffectId: event.target.value }))}
                >
                  <option value="">None</option>
                  {authoring.modifierEffectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              </label>

              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  aria-label="author effect notes"
                  className={styles.textArea}
                  rows={3}
                  value={effectForm.notes}
                  onChange={(event) => setEffectForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <div className={styles.buttonRow}>
                <Button
                  onClick={() =>
                    void runAction({
                      action: 'upsertEffect',
                      effectId: effectMode === 'edit' ? editingEffectId : null,
                      locationId: selectedLocationId as string,
                      title: effectForm.title,
                      summary: effectForm.summary,
                      status: effectForm.status as Effect['status'],
                      notes: effectForm.notes,
                      effectType: effectForm.effectType,
                      scope: (effectForm.scope || null) as Effect['scope'],
                      severity: (effectForm.severity || null) as Effect['severity'],
                      modifierEffectId: effectForm.modifierEffectId || null,
                    })
                  }
                  disabled={pending || !selectedLocationId || effectForm.title.trim().length === 0 || effectForm.summary.trim().length === 0}
                >
                  {pending ? 'Saving...' : effectMode === 'edit' ? 'Save effect' : 'Create effect'}
                </Button>
              </div>
            </div>
          </section>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
