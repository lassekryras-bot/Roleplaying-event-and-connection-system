'use client';

import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Select } from '@/components/ui';
import { useAuth } from '@/contexts/auth-context';
import { normalizeFrontendRole } from '@/lib/roles';

import { CampaignV2AuthoringPanel } from './CampaignV2AuthoringPanel';
import { fetchCampaignV2Inspector, saveCampaignV2TrustedLocationIdentity } from './api';
import styles from './CampaignV2Inspector.module.css';
import type { CampaignV2DualWriteReport, CampaignV2InspectorPayload } from './types';

function formatLoadedAt(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function joinValues(values: readonly string[]) {
  return values.length > 0 ? values.join(', ') : 'None';
}

function normalizeTags(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function parseTags(value: string) {
  return normalizeTags(value.split(','));
}

function joinTags(values: readonly string[]) {
  return normalizeTags(values).join(', ');
}

export function CampaignV2Inspector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, role } = useAuth();
  const normalizedRole = normalizeFrontendRole(role);
  const requestedProjectId = searchParams.get('project') ?? undefined;
  const requestedLocationId = searchParams.get('location') ?? undefined;
  const requestIdRef = useRef(0);

  const [payload, setPayload] = useState<CampaignV2InspectorPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveReport, setSaveReport] = useState<CampaignV2DualWriteReport | null>(null);

  async function loadInspector(projectId?: string, locationId?: string) {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    setLoading(true);
    setLoadError('');

    try {
      const nextPayload = await fetchCampaignV2Inspector(projectId, locationId);
      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      startTransition(() => {
        setPayload(nextPayload);
      });
    } catch (error) {
      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      setLoadError(error instanceof Error ? error.message : 'Failed to load the campaign-v2 inspector.');
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!isAuthenticated && normalizedRole === '') {
      return;
    }

    if (normalizedRole !== '' && normalizedRole !== 'gm') {
      return;
    }

    void loadInspector(requestedProjectId, requestedLocationId);
  }, [requestedLocationId, requestedProjectId, isAuthenticated, normalizedRole]);

  const projectOptions = payload?.projects ?? [];
  const selectedProjectId = payload?.project?.id ?? requestedProjectId ?? '';
  const selectedLocationId = payload?.selectedLocationId ?? requestedLocationId ?? '';
  const overview = payload?.overview ?? null;
  const locationTimeline = payload?.locationTimeline ?? null;
  const prep = payload?.prep ?? null;
  const migrationChecklist = payload?.migrationChecklist ?? null;
  const selectedLocation = useMemo(
    () => payload?.locations.find((location) => location.id === selectedLocationId) ?? null,
    [payload?.locations, selectedLocationId],
  );
  const parsedDraftTags = useMemo(() => parseTags(draftTags), [draftTags]);
  const draftHasChanges = useMemo(() => {
    if (!selectedLocation) {
      return false;
    }

    return (
      draftTitle.trim() !== selectedLocation.title ||
      draftSummary.trim() !== selectedLocation.summary ||
      JSON.stringify(parsedDraftTags) !== JSON.stringify(normalizeTags(selectedLocation.tags))
    );
  }, [draftSummary, draftTitle, parsedDraftTags, selectedLocation]);
  const diagnostics = useMemo(
    () => [...(overview?.diagnosticMessages ?? []), ...(locationTimeline?.diagnosticMessages ?? [])],
    [locationTimeline?.diagnosticMessages, overview?.diagnosticMessages],
  );

  useEffect(() => {
    if (!selectedLocation) {
      setDraftTitle('');
      setDraftSummary('');
      setDraftTags('');
      return;
    }

    setDraftTitle(selectedLocation.title);
    setDraftSummary(selectedLocation.summary);
    setDraftTags(joinTags(selectedLocation.tags));
  }, [selectedLocation]);

  useEffect(() => {
    setSaveError('');
    setSaveReport(null);
  }, [selectedProjectId, selectedLocationId]);

  function replaceSearchParams(nextProjectId?: string, nextLocationId?: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('surface', 'v2-inspector');

    if (nextProjectId) {
      nextParams.set('project', nextProjectId);
    } else {
      nextParams.delete('project');
    }

    if (nextLocationId) {
      nextParams.set('location', nextLocationId);
    } else {
      nextParams.delete('location');
    }

    router.replace(`/timeline?${nextParams.toString()}`);
  }

  function handleProjectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    replaceSearchParams(event.target.value || undefined, undefined);
  }

  function handleLocationChange(event: React.ChangeEvent<HTMLSelectElement>) {
    replaceSearchParams(selectedProjectId || undefined, event.target.value || undefined);
  }

  function handleOpenClassicTimeline() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('surface', 'classic');
    nextParams.delete('location');
    router.replace(`/timeline${nextParams.size > 0 ? `?${nextParams.toString()}` : ''}`);
  }

  async function handleSaveLocationIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!payload?.project || !selectedLocation || !payload.trustedLocationDualWriteEnabled || savePending) {
      return;
    }

    setSavePending(true);
    setSaveError('');

    try {
      const result = await saveCampaignV2TrustedLocationIdentity({
        projectId: payload.project.id,
        locationId: selectedLocation.id,
        title: draftTitle.trim(),
        summary: draftSummary.trim(),
        tags: parsedDraftTags,
      });
      setSaveReport(result.report);

      startTransition(() => {
        setPayload(result.payload);
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save the trusted dual-write edit.');
    } finally {
      setSavePending(false);
    }
  }

  if (!isAuthenticated && normalizedRole === '') {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>Loading campaign-v2 inspector…</div>
        </div>
      </section>
    );
  }

  if (normalizedRole !== 'gm') {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>The campaign-v2 inspector is GM-only in this phase.</div>
        </div>
      </section>
    );
  }

  if (loading && !payload) {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>Loading campaign-v2 inspector…</div>
        </div>
      </section>
    );
  }

  if (loadError && !payload) {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>{loadError}</div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.shell} data-testid="campaign-v2-inspector">
      <div className={styles.panel}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Campaign V2 Inspector</p>
          <h1>{payload?.project?.name ?? 'Campaign V2'}</h1>
          <div className={styles.heroMeta}>
            <span>Source: {payload?.contentSubdir ?? 'none'}</span>
            <span>Loaded: {payload ? formatLoadedAt(payload.loadedAt) : 'just now'}</span>
          </div>

          <div className={styles.controls}>
            <label className={styles.field}>
              <span>Project</span>
              <Select
                aria-label="campaign-v2 project selector"
                value={selectedProjectId}
                onChange={handleProjectChange}
              >
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className={styles.field}>
              <span>Location Timeline</span>
              <Select
                aria-label="campaign-v2 location selector"
                value={selectedLocationId}
                onChange={handleLocationChange}
              >
                {(payload?.locations ?? []).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.title}
                  </option>
                ))}
              </Select>
            </label>

            <div className={styles.buttonRow}>
              <Button onClick={() => void loadInspector(selectedProjectId || undefined, selectedLocationId || undefined)}>
                Refresh
              </Button>
              <Button variant="ghost" onClick={handleOpenClassicTimeline}>
                Open classic fallback
              </Button>
            </div>
          </div>
        </header>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Locations</span>
            <span className={styles.statValue}>{payload?.counts.locations ?? 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>States</span>
            <span className={styles.statValue}>{payload?.counts.locationStates ?? 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Sessions</span>
            <span className={styles.statValue}>{payload?.counts.sessions ?? 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Events</span>
            <span className={styles.statValue}>{payload?.counts.events ?? 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Effects</span>
            <span className={styles.statValue}>{payload?.counts.effects ?? 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Warnings</span>
            <span className={styles.statValue}>{payload?.counts.invalidFiles ?? 0}</span>
          </div>
        </div>

        <div className={styles.sectionGrid}>
          <div className={styles.column}>
            <section className={styles.card}>
              <h2>GM Overview</h2>
              <p className={styles.subtle}>Read-only v2 payload built from the dedicated resolver layer.</p>
              <div className={styles.stack}>
                <div className={styles.listItem}>
                  <div className={styles.listItemTitle}>
                    <strong>Previous session</strong>
                  </div>
                  <div>{overview?.previousSession?.title ?? 'None yet'}</div>
                  {overview?.previousSession?.summary ? <p className={styles.subtle}>{overview.previousSession.summary}</p> : null}
                </div>

                <div className={styles.listItem}>
                  <div className={styles.listItemTitle}>
                    <strong>Current session</strong>
                  </div>
                  <div>{overview?.currentSession?.title ?? 'No active v2 session yet'}</div>
                  {overview?.currentSession?.summary ? <p className={styles.subtle}>{overview.currentSession.summary}</p> : null}
                </div>

                <div className={styles.listItem}>
                  <div className={styles.listItemTitle}>
                    <strong>Likely next locations</strong>
                  </div>
                  {(overview?.likelyNextLocations ?? []).length > 0 ? (
                    <div className={styles.stack}>
                      {overview?.likelyNextLocations.map((location) => (
                        <div key={location.id}>
                          <strong>{location.title}</strong>
                          <p className={styles.subtle}>{location.summary}</p>
                          <div className={styles.chips}>
                            {location.reasons.map((reason) => (
                              <span key={reason} className={styles.chip}>
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.subtle}>No next-location hints yet.</div>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <h2>Location Timeline</h2>
              <p className={styles.subtle}>
                {locationTimeline?.location.title ?? 'No location selected'}
                {locationTimeline?.location.summary ? ` · ${locationTimeline.location.summary}` : ''}
              </p>

              {(locationTimeline?.entries ?? []).length > 0 ? (
                <div className={styles.stack}>
                  {locationTimeline?.entries.map((entry) => (
                    <div key={`${entry.kind}-${entry.id}`} className={styles.timelineRow}>
                      <div className={styles.timelineNumber}>#{entry.sequence}</div>
                      <div className={styles.listItem}>
                        <div className={styles.listItemTitle}>
                          <strong>{entry.title}</strong>
                          <span className={styles.subtle}>{entry.kind}</span>
                        </div>
                        <p className={styles.subtle}>{entry.summary}</p>
                        {'status' in entry ? <div className={styles.subtle}>Status: {entry.status}</div> : null}
                        {'locationTitle' in entry && entry.locationTitle ? (
                          <div className={styles.subtle}>Location: {entry.locationTitle}</div>
                        ) : null}
                        {'startingLocationStateTitle' in entry && entry.startingLocationStateTitle ? (
                          <div className={styles.subtle}>Start: {entry.startingLocationStateTitle}</div>
                        ) : null}
                        {'resultingLocationStateTitle' in entry && entry.resultingLocationStateTitle ? (
                          <div className={styles.subtle}>Result: {entry.resultingLocationStateTitle}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No v2 timeline entries are available for this location yet.</div>
              )}
            </section>

            <section className={styles.card}>
              <h2>Prep Answers</h2>
              <p className={styles.subtle}>
                Read-only prep guidance generated from the v2 resolver layer for {prep?.selectedLocationTitle ?? 'the selected location'}.
              </p>

              {prep ? (
                <div className={styles.stack}>
                  {Object.values(prep.answers).map((answer) => (
                    <div key={answer.key} className={styles.listItem}>
                      <div className={styles.prepQuestion}>{answer.question}</div>
                      <p className={styles.prepSummary}>{answer.summary}</p>
                      {answer.bullets.length > 0 ? (
                        <ul className={styles.prepBulletList}>
                          {answer.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                      {answer.references.length > 0 ? (
                        <div className={styles.chips}>
                          {answer.references.map((reference) => (
                            <span key={`${reference.kind}-${reference.id}`} className={styles.chip}>
                              {reference.kind}: {reference.title}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No v2 prep answers are available yet.</div>
              )}
            </section>

            <section className={styles.card}>
              <h2>Migration Status</h2>
              <p className={styles.subtle}>
                Use this checklist before deleting the old model or its conversion paths.
              </p>

              {migrationChecklist ? (
                <div className={styles.stack}>
                  {migrationChecklist.items.map((item) => (
                    <div key={item.key} className={styles.listItem}>
                      <div className={styles.listItemTitle}>
                        <strong>{item.title}</strong>
                        <span className={styles.subtle}>{item.status}</span>
                      </div>
                      <p className={styles.subtle}>{item.detail}</p>
                    </div>
                  ))}
                  <div className={styles.listItem}>
                    <div className={styles.listItemTitle}>
                      <strong>Validation command</strong>
                    </div>
                    <code className={styles.inlineCode}>{migrationChecklist.validationCommand}</code>
                  </div>
                </div>
              ) : (
                <div className={styles.empty}>No migration checklist is available yet.</div>
              )}
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.card}>
              <h3>Legacy Write Bridge</h3>
              <p className={styles.subtle}>
                {payload?.trustedLocationDualWriteEnabled
                  ? 'This path updates shared location identity fields in both the old gm-timeline place and the new campaign-v2 location.'
                  : 'Legacy dual-write is frozen. Campaign-v2 authoring below is now the only write path.'}
              </p>

              {payload?.trustedLocationDualWriteEnabled && selectedLocation ? (
                <form className={styles.formGrid} onSubmit={handleSaveLocationIdentity}>
                  <label className={styles.field}>
                    <span>Title</span>
                    <input
                      aria-label="location title"
                      className={styles.textInput}
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Summary</span>
                    <textarea
                      aria-label="location summary"
                      className={styles.textArea}
                      rows={4}
                      value={draftSummary}
                      onChange={(event) => setDraftSummary(event.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Tags</span>
                    <input
                      aria-label="location tags"
                      className={styles.textInput}
                      value={draftTags}
                      onChange={(event) => setDraftTags(event.target.value)}
                    />
                  </label>

                  <p className={styles.helperText}>Comma-separated. This trusted flow only writes title, summary, and tags.</p>

                  <div className={styles.buttonRow}>
                    <Button
                      type="submit"
                      disabled={
                        savePending || draftTitle.trim().length === 0 || draftSummary.trim().length === 0 || !draftHasChanges
                      }
                    >
                      {savePending ? 'Saving dual-write...' : 'Save dual-write'}
                    </Button>
                  </div>
                </form>
              ) : null}

              {saveError ? (
                <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">
                  {saveError}
                </div>
              ) : null}

              {saveReport ? (
                <div
                  className={`${styles.banner} ${saveReport.success ? styles.bannerSuccess : styles.bannerWarning}`}
                  role="status"
                >
                  <strong>{saveReport.success ? 'Old and new writes matched.' : 'Dual-write needs attention.'}</strong>
                  <div>Old: {saveReport.oldWrite.message}</div>
                  <div>New: {saveReport.newWrite.message}</div>
                  {saveReport.divergenceReasons.length > 0 ? (
                    <div>Divergence: {saveReport.divergenceReasons.join(' ')}</div>
                  ) : null}
                </div>
              ) : null}
            </section>

            {payload ? (
              <CampaignV2AuthoringPanel
                payload={payload}
                onPayloadChange={(nextPayload) => {
                  startTransition(() => {
                    setPayload(nextPayload);
                  });
                }}
              />
            ) : null}

            <section className={styles.card}>
              <h3>Related Events</h3>
              {(overview?.relatedEvents ?? []).length > 0 ? (
                <div className={styles.stack}>
                  {overview?.relatedEvents.map((event) => (
                    <div key={event.id} className={styles.listItem}>
                      <div className={styles.listItemTitle}>
                        <strong>{event.title}</strong>
                        <span className={styles.subtle}>{event.status}</span>
                      </div>
                      <p className={styles.subtle}>{event.summary}</p>
                      <div className={styles.subtle}>Locations: {joinValues(event.locationTitles)}</div>
                      <div className={styles.subtle}>Sessions: {joinValues(event.sessionTitles)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No related v2 events yet.</div>
              )}
            </section>

            <section className={styles.card}>
              <h3>Related Effects</h3>
              {(overview?.relatedEffects ?? []).length > 0 ? (
                <div className={styles.stack}>
                  {overview?.relatedEffects.map((effect) => (
                    <div key={effect.id} className={styles.listItem}>
                      <div className={styles.listItemTitle}>
                        <strong>{effect.title}</strong>
                        <span className={styles.subtle}>{effect.scope ?? 'unspecified scope'}</span>
                      </div>
                      <p className={styles.subtle}>{effect.summary}</p>
                      <div className={styles.subtle}>Severity: {effect.severity ?? 'n/a'}</div>
                      <div className={styles.chips}>
                        {effect.relevanceByLocation.flatMap((entry) =>
                          entry.kinds.map((kind) => (
                            <span key={`${entry.locationId}-${kind}`} className={styles.chip}>
                              {entry.locationTitle}: {kind}
                            </span>
                          )),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No related v2 effects yet.</div>
              )}
            </section>

            <section className={styles.card}>
              <h3>Diagnostics</h3>
              {diagnostics.length > 0 ? (
                <div className={styles.stack}>
                  {diagnostics.map((diagnostic) => (
                    <div key={diagnostic} className={styles.listItem}>
                      <span className={styles.subtle}>{diagnostic}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>No resolver or content warnings.</div>
              )}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
