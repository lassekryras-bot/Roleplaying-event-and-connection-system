'use client';

import Link from 'next/link';
import React from 'react';

import type {
  CampaignV2PlayerCharacterDetailViewModel,
  CampaignV2PlayerCharacterEntityLinkViewModel,
  CampaignV2PlayerCharacterRelationViewModel,
  CampaignV2PlayerCharacterThreadViewModel,
} from '@/server/campaign-v2';

import styles from './PlayerCharacterDetailPage.module.css';

export function CharacterSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>{title}</h2>
        {description ? <p className={styles.subtle}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function CharacterSubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.subsection}>
      <h3 className={styles.subsectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

export function CharacterFieldList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className={styles.fieldList}>
      {items.map((item) => (
        <div key={item.label} className={styles.fieldRow}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CharacterPillList({
  values,
  emptyLabel,
}: {
  values: readonly string[];
  emptyLabel: string;
}) {
  if (values.length === 0) {
    return <div className={styles.emptyInline}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.chips}>
      {values.map((value) => (
        <span key={value} className={styles.chip}>
          {value}
        </span>
      ))}
    </div>
  );
}

function renderLinkedTitle(title: string, href: string | null) {
  return href ? (
    <Link href={href} className={styles.inlineLink}>
      {title}
    </Link>
  ) : (
    <span>{title}</span>
  );
}

export function CharacterThreadList({
  threads,
  emptyLabel,
}: {
  threads: readonly CampaignV2PlayerCharacterThreadViewModel[];
  emptyLabel: string;
}) {
  if (threads.length === 0) {
    return <div className={styles.emptyInline}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.stack}>
      {threads.map((thread) => (
        <article key={thread.id} className={styles.listItem}>
          <div className={styles.listItemHeader}>
            <strong>{renderLinkedTitle(thread.title, thread.href)}</strong>
            <span className={styles.subtle}>{thread.state ?? (thread.missing ? 'missing' : 'state unknown')}</span>
          </div>
          {thread.playerSummary ? <p className={styles.paragraph}>{thread.playerSummary}</p> : null}
          {thread.gmTruth ? (
            <p className={styles.metaCopy}>
              <strong>GM truth:</strong> {thread.gmTruth}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function CharacterRelationList({
  relations,
  emptyLabel,
}: {
  relations: readonly CampaignV2PlayerCharacterRelationViewModel[];
  emptyLabel: string;
}) {
  if (relations.length === 0) {
    return <div className={styles.emptyInline}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.stack}>
      {relations.map((relation, index) => (
        <article key={`${relation.type}-${relation.targetId}-${index}`} className={styles.listItem}>
          <div className={styles.listItemHeader}>
            <strong>{renderLinkedTitle(relation.targetTitle, relation.href)}</strong>
            <span className={styles.subtle}>{relation.type}</span>
          </div>
          <p className={styles.metaCopy}>
            Target: {relation.targetType}
            {relation.missing ? ' (missing)' : ''}
          </p>
          {relation.note ? <p className={styles.paragraph}>{relation.note}</p> : null}
          {relation.status || relation.strength || relation.origin || relation.active !== null ? (
            <p className={styles.metaCopy}>
              {[relation.status, relation.strength, relation.origin, relation.active === null ? null : relation.active ? 'active' : 'inactive']
                .filter((value): value is string => Boolean(value))
                .join(' | ')}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function CharacterEntityList({
  entities,
  emptyLabel,
}: {
  entities: readonly CampaignV2PlayerCharacterEntityLinkViewModel[];
  emptyLabel: string;
}) {
  if (entities.length === 0) {
    return <div className={styles.emptyInline}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.stack}>
      {entities.map((entity) => (
        <article key={`${entity.type}-${entity.id}`} className={styles.listItem}>
          <div className={styles.listItemHeader}>
            <strong>{renderLinkedTitle(entity.title, entity.href)}</strong>
            <span className={styles.subtle}>{entity.type}</span>
          </div>
          {entity.summary ? <p className={styles.paragraph}>{entity.summary}</p> : null}
          {entity.status ? <p className={styles.metaCopy}>Status: {entity.status}</p> : null}
          {entity.missing ? <p className={styles.metaCopy}>This reference could not be resolved.</p> : null}
        </article>
      ))}
    </div>
  );
}

export function CharacterNotesList({
  notes,
}: {
  notes: CampaignV2PlayerCharacterDetailViewModel['relationshipNotes'];
}) {
  if (notes.length === 0) {
    return <div className={styles.emptyInline}>No relationship notes yet.</div>;
  }

  return (
    <div className={styles.stack}>
      {notes.map((note) => (
        <article key={`${note.label}-${note.role}`} className={styles.listItem}>
          <div className={styles.listItemHeader}>
            <strong>{note.label}</strong>
            <span className={styles.subtle}>{note.role}</span>
          </div>
          {note.note ? <p className={styles.paragraph}>{note.note}</p> : null}
        </article>
      ))}
    </div>
  );
}
