'use client';

import Link from 'next/link';
import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Select } from '@/components/ui';
import { useAuth } from '@/contexts/auth-context';
import { fetchCampaignV2PlayerCharacter } from '@/features/campaign-v2/api';
import type { CampaignV2PlayerCharacterPagePayload } from '@/features/campaign-v2/types';
import { canViewGmContent, normalizeFrontendRole } from '@/lib/roles';
import { usePreferredProject } from '@/lib/use-preferred-project';

import {
  CharacterEntityList,
  CharacterFieldList,
  CharacterNotesList,
  CharacterPillList,
  CharacterRelationList,
  CharacterSection,
  CharacterSubsection,
  CharacterThreadList,
} from './PlayerCharacterSections';
import styles from './PlayerCharacterDetailPage.module.css';

function formatLoadedAt(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function PlayerCharacterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, role } = useAuth();
  const { preferredProjectId, preferenceLoaded, rememberProject } = usePreferredProject();
  const normalizedRole = normalizeFrontendRole(role);
  const canSeeGmReference = canViewGmContent(normalizedRole);
  const requestedProjectId = searchParams.get('project') ?? undefined;
  const effectiveRequestedProjectId = requestedProjectId ?? preferredProjectId ?? undefined;
  const projectSelectionReady = Boolean(requestedProjectId) || preferenceLoaded;
  const requestIdRef = useRef(0);

  const [playerCharacterId, setPlayerCharacterId] = useState('');
  const [payload, setPayload] = useState<CampaignV2PlayerCharacterPagePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.resolve(params)
      .then((resolvedParams) => {
        setPlayerCharacterId(resolvedParams.id);
      })
      .catch((error: Error) => {
        setLoadError(error.message);
      });
  }, [params]);

  async function loadPlayerCharacter(nextPlayerCharacterId: string, projectId?: string) {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;
    setLoading(true);
    setLoadError('');

    try {
      const nextPayload = await fetchCampaignV2PlayerCharacter(nextPlayerCharacterId, projectId);
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

      setLoadError(error instanceof Error ? error.message : 'Failed to load the player character page.');
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!playerCharacterId) {
      return;
    }

    if (!projectSelectionReady) {
      return;
    }

    if (!isAuthenticated && normalizedRole === '') {
      return;
    }

    if (normalizedRole !== '' && !canSeeGmReference) {
      return;
    }

    void loadPlayerCharacter(playerCharacterId, effectiveRequestedProjectId);
  }, [
    canSeeGmReference,
    effectiveRequestedProjectId,
    isAuthenticated,
    normalizedRole,
    playerCharacterId,
    projectSelectionReady,
  ]);

  const detail = payload?.detail?.playerCharacter ?? null;
  const projects = payload?.projects ?? [];
  const characterOptions = payload?.playerCharacters ?? [];
  const selectedProjectId = payload?.project?.id ?? effectiveRequestedProjectId ?? '';
  const selectedPlayerCharacterId = payload?.selectedPlayerCharacterId ?? playerCharacterId;

  const heroBadges = useMemo(
    () =>
      [
        detail?.status ?? null,
        detail?.ancestry ?? null,
        detail?.characterClass ?? null,
        detail?.age !== null && detail?.age !== undefined ? `${detail.age} years` : null,
      ].filter((value): value is string => Boolean(value)),
    [detail?.age, detail?.ancestry, detail?.characterClass, detail?.status],
  );

  function replaceSearch(nextPlayerCharacterId: string, nextProjectId?: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextProjectId) {
      nextParams.set('project', nextProjectId);
    } else {
      nextParams.delete('project');
    }

    router.replace(
      `/player-characters/${encodeURIComponent(nextPlayerCharacterId)}${
        nextParams.size > 0 ? `?${nextParams.toString()}` : ''
      }`,
    );
  }

  function handleProjectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextProjectId = event.target.value || undefined;
    void rememberProject(nextProjectId);
    const nextPlayerCharacterId = characterOptions[0]?.id ?? playerCharacterId;
    replaceSearch(nextPlayerCharacterId, nextProjectId);
  }

  function handlePlayerCharacterChange(event: React.ChangeEvent<HTMLSelectElement>) {
    replaceSearch(event.target.value, selectedProjectId || undefined);
  }

  if (!isAuthenticated && normalizedRole === '') {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>Loading player character reference...</div>
        </div>
      </section>
    );
  }

  if (!canSeeGmReference) {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>The player character reference page is GM-only in this phase.</div>
        </div>
      </section>
    );
  }

  if (loading && !payload) {
    return (
      <section className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.empty}>Loading player character reference...</div>
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
    <section className={styles.shell} data-testid="player-character-page">
      <div className={styles.panel}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Campaign V2 Player Character</p>
          <div className={styles.heroTitleRow}>
            <h1>{detail?.title ?? (selectedPlayerCharacterId || 'Player character')}</h1>
            <p className={styles.heroSummary}>
              {detail?.summary ?? 'Read-only GM reference page for campaign truth and integration.'}
            </p>
            <dl className={styles.heroFacts}>
              <div className={styles.heroFact}>
                <dt>Concept</dt>
                <dd>{detail?.concept ?? 'No concept recorded yet.'}</dd>
              </div>
              <div className={styles.heroFact}>
                <dt>Status</dt>
                <dd>{detail?.status ?? 'Unknown'}</dd>
              </div>
              <div className={styles.heroFact}>
                <dt>Party role</dt>
                <dd>{detail?.partyRole ?? 'Unspecified'}</dd>
              </div>
            </dl>
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.metaBadge}>Project: {payload?.project?.name ?? 'Unknown project'}</span>
            <span className={styles.metaBadge}>Loaded: {payload ? formatLoadedAt(payload.loadedAt) : 'just now'}</span>
            {heroBadges.map((badge) => (
              <span key={badge} className={styles.metaBadge}>
                {badge}
              </span>
            ))}
          </div>

          <div className={styles.controls}>
            <label className={styles.field}>
              <span>Project</span>
              <Select aria-label="player character project selector" value={selectedProjectId} onChange={handleProjectChange}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className={styles.field}>
              <span>Player Character</span>
              <Select
                aria-label="player character selector"
                value={selectedPlayerCharacterId}
                onChange={handlePlayerCharacterChange}
              >
                {characterOptions.map((playerCharacter) => (
                  <option key={playerCharacter.id} value={playerCharacter.id}>
                    {playerCharacter.title}
                  </option>
                ))}
              </Select>
            </label>

            <div className={styles.buttonRow}>
              <Button onClick={() => void loadPlayerCharacter(selectedPlayerCharacterId, selectedProjectId || undefined)}>
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {loadError ? <div className={styles.empty}>{loadError}</div> : null}

        {!detail ? (
          <div className={styles.empty}>No v2 player character was found for this project.</div>
        ) : (
          <div className={styles.overviewGrid}>
            <div className={styles.column}>
              <CharacterSection title="Campaign Fit" description="How this character plugs into the campaign's active meaning.">
                <CharacterFieldList items={[{ label: 'Campaign fit summary', value: detail.campaignFitSummary }]} />
                <CharacterSubsection title="Starting threads">
                  <CharacterThreadList threads={detail.startingThreads} emptyLabel="No starting threads linked yet." />
                </CharacterSubsection>
                <CharacterSubsection title="Core threads">
                  <CharacterThreadList threads={detail.coreThreads} emptyLabel="No core threads linked yet." />
                </CharacterSubsection>
              </CharacterSection>

              <CharacterSection title="Current Situation" description="What the GM should understand immediately during prep or play.">
                <CharacterFieldList
                  items={[
                    { label: 'Overview', value: detail.currentSituation.overview ?? 'No current overview yet.' },
                    { label: 'Legal status', value: detail.currentSituation.legalStatus ?? 'Unspecified' },
                    { label: 'Social status', value: detail.currentSituation.socialStatus ?? 'Unspecified' },
                    { label: 'Current problem', value: detail.currentSituation.currentProblem ?? 'No current problem recorded.' },
                    {
                      label: 'Current location',
                      value: detail.currentSituation.currentLocationHref ? (
                        <Link href={detail.currentSituation.currentLocationHref} className={styles.inlineLink}>
                          {detail.currentSituation.currentLocationTitle ?? detail.currentSituation.currentLocationId}
                        </Link>
                      ) : (
                        detail.currentSituation.currentLocationTitle ?? detail.currentSituation.currentLocationId ?? 'Unspecified'
                      ),
                    },
                  ]}
                />
              </CharacterSection>

              <CharacterSection title="Goals" description="Short, mid, and long-term direction for spotlight planning.">
                <CharacterFieldList
                  items={[
                    { label: 'Short term', value: detail.goals.shortTerm ?? 'Not recorded yet' },
                    { label: 'Mid term', value: detail.goals.midTerm ?? 'Not recorded yet' },
                    { label: 'Long term', value: detail.goals.longTerm ?? 'Not recorded yet' },
                  ]}
                />
              </CharacterSection>

              <CharacterSection title="Background" description="Origin, history, and the motive that keeps the character relevant.">
                <CharacterFieldList
                  items={[
                    { label: 'Origin', value: detail.background.origin ?? 'Unknown' },
                    { label: 'History', value: detail.background.history ?? 'Not recorded yet' },
                    { label: 'Inciting incident', value: detail.background.incitingIncident ?? 'Not recorded yet' },
                    { label: 'Reason in city / campaign', value: detail.background.reasonInCity ?? 'Not recorded yet' },
                  ]}
                />
              </CharacterSection>

              <CharacterSection title="Traits" description="Quick-scan strengths, flaws, and personality hooks.">
                <CharacterFieldList
                  items={[
                    {
                      label: 'Strengths',
                      value: <CharacterPillList values={detail.traits.strengths} emptyLabel="No strengths listed yet." />,
                    },
                    {
                      label: 'Flaws',
                      value: <CharacterPillList values={detail.traits.flaws} emptyLabel="No flaws listed yet." />,
                    },
                    {
                      label: 'Personality',
                      value: <CharacterPillList values={detail.traits.personality} emptyLabel="No personality notes yet." />,
                    },
                  ]}
                />
              </CharacterSection>
            </div>

            <div className={styles.column}>
              <CharacterSection
                title="Relations and Linked Entities"
                description="Resolved ties, connection targets, and other campaign references surfaced from the v2 model."
              >
                <CharacterSubsection title="Explicit relations">
                  <CharacterRelationList relations={detail.relations} emptyLabel="No explicit relations linked yet." />
                </CharacterSubsection>

                <CharacterSubsection title="Linked entities">
                  <CharacterEntityList entities={detail.linkedEntities} emptyLabel="No linked entities surfaced yet." />
                </CharacterSubsection>

                <CharacterSubsection title="Connection buckets">
                  <div className={styles.groupGrid}>
                    <div className={styles.groupCard}>
                      <h4>Important NPCs</h4>
                      <CharacterEntityList
                        entities={detail.connections.importantNpcs}
                        emptyLabel="No important NPCs linked in connections."
                      />
                    </div>
                    <div className={styles.groupCard}>
                      <h4>Important locations</h4>
                      <CharacterEntityList
                        entities={detail.connections.importantLocations}
                        emptyLabel="No important locations linked in connections."
                      />
                    </div>
                    <div className={styles.groupCard}>
                      <h4>Important threads</h4>
                      <CharacterThreadList
                        threads={detail.connections.importantThreads}
                        emptyLabel="No additional important threads linked in connections."
                      />
                    </div>
                    <div className={styles.groupCard}>
                      <h4>Important hooks</h4>
                      <CharacterEntityList
                        entities={detail.connections.importantHooks}
                        emptyLabel="No important hooks listed in connections."
                      />
                    </div>
                  </div>
                </CharacterSubsection>

                <CharacterSubsection title="Relationship notes">
                  <CharacterNotesList notes={detail.relationshipNotes} />
                </CharacterSubsection>
              </CharacterSection>

              <CharacterSection
                title="GM Notes and Spotlight"
                description="Themes, reminders, and optional support details for live use behind the screen."
              >
                <CharacterFieldList
                  items={[
                    {
                      label: 'Spotlight themes',
                      value: <CharacterPillList values={detail.spotlight.themes} emptyLabel="No spotlight themes listed yet." />,
                    },
                    { label: 'GM notes', value: detail.spotlight.gmNotes ?? 'No GM spotlight notes yet.' },
                    { label: 'General notes', value: detail.notes ?? 'No additional notes yet.' },
                    {
                      label: 'Signature items',
                      value: <CharacterPillList values={detail.assets.signatureItems} emptyLabel="No signature items listed yet." />,
                    },
                    {
                      label: 'Special capabilities',
                      value: (
                        <CharacterPillList
                          values={detail.assets.specialCapabilities}
                          emptyLabel="No special capabilities listed yet."
                        />
                      ),
                    },
                  ]}
                />

                {payload?.detail?.diagnosticMessages.length ? (
                  <CharacterSubsection title="Reference warnings">
                    <div className={styles.diagnosticList}>
                      {payload.detail.diagnosticMessages.map((message) => (
                        <div key={message} className={styles.diagnosticItem}>
                          {message}
                        </div>
                      ))}
                    </div>
                  </CharacterSubsection>
                ) : null}
              </CharacterSection>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
