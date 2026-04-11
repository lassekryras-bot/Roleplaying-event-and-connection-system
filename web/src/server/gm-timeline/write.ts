import fs from 'node:fs/promises';
import path from 'node:path';

import type { Place, PlaceIndex } from '@/generated/gm-timeline';

import { resolveGmTimelinePaths, type GmTimelineLoaderOptions } from './loader';
import { createGmTimelineValidator } from './validation';

export type SaveGmTimelinePlaceResult = {
  place: Place;
  relativePath: string;
  indexUpdated: boolean;
};

function resolvePlaceRelativePath(id: string) {
  return path.posix.join('places', `${id}.json`);
}

function resolvePlaceFilePath(contentRoot: string, id: string) {
  return path.join(contentRoot, 'places', `${id}.json`);
}

function resolvePlaceIndexPath(contentRoot: string) {
  return path.join(contentRoot, 'places', 'index.json');
}

async function writeJsonAtomically(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempFilePath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const contents = `${JSON.stringify(payload, null, 2)}\n`;

  try {
    await fs.writeFile(tempFilePath, contents, 'utf8');
    await fs.rename(tempFilePath, filePath);
  } catch (error) {
    await fs.rm(tempFilePath, { force: true });
    throw error;
  }
}

function normalizePlace(place: Place): Place {
  return {
    ...place,
    tags: [...new Set(place.tags ?? [])],
    hookIds: [...new Set(place.hookIds ?? [])],
  };
}

function updatePlaceIndex(placeIndex: PlaceIndex, place: Place): PlaceIndex {
  const nextItems = placeIndex.items.map((item) =>
    item.id === place.id
      ? {
          ...item,
          headline: place.headline,
          description: place.description,
          tags: place.tags,
        }
      : item,
  );

  return {
    ...placeIndex,
    generatedAt: place.updatedAt ?? placeIndex.generatedAt,
    items: nextItems,
  };
}

export async function saveGmTimelinePlace(options: GmTimelineLoaderOptions, place: Place): Promise<SaveGmTimelinePlaceResult> {
  const resolvedPaths = resolveGmTimelinePaths(options);
  const validator = await createGmTimelineValidator(resolvedPaths.schemaRoot);
  const normalizedPlace = normalizePlace(place);
  const relativePath = resolvePlaceRelativePath(normalizedPlace.id);
  const validationResult = validator.validate('place', normalizedPlace, {
    projectId: options.projectId,
    relativePath,
  });

  if (!validationResult.valid) {
    throw new Error(`${relativePath}: ${validationResult.diagnostic.message}`);
  }

  await writeJsonAtomically(resolvePlaceFilePath(resolvedPaths.contentRoot, normalizedPlace.id), normalizedPlace);

  let indexUpdated = false;
  const placeIndexPath = resolvePlaceIndexPath(resolvedPaths.contentRoot);

  try {
    const existingIndex = JSON.parse(await fs.readFile(placeIndexPath, 'utf8')) as PlaceIndex;
    const nextIndex = updatePlaceIndex(existingIndex, normalizedPlace);
    const indexValidationResult = validator.validate('placeIndex', nextIndex, {
      projectId: options.projectId,
      relativePath: 'places/index.json',
    });

    if (!indexValidationResult.valid) {
      throw new Error(`places/index.json: ${indexValidationResult.diagnostic.message}`);
    }

    await writeJsonAtomically(placeIndexPath, nextIndex);
    indexUpdated = true;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    place: normalizedPlace,
    relativePath,
    indexUpdated,
  };
}
