import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models/base-item-person';
import { jellyfinClient } from './JellyfinClient';

/**
 * Image URL builders, wrapping @jellyfin/sdk's `ImageUrlsApi` (mirrors `ItemCardImage.kt`'s
 * image URL resolution). Every helper is sized to a requested display width so the server can
 * downscale rather than shipping full-resolution artwork to a poster-sized card.
 */

const QUALITY = 90;

export function primaryImageUrl(item: BaseItemDto, width: number): string | undefined {
  return getImageApi(jellyfinClient.api).getItemImageUrl(item, ImageType.Primary, {
    fillWidth: Math.round(width),
    quality: QUALITY,
  });
}

export function backdropImageUrl(item: BaseItemDto, width: number): string | undefined {
  const [url] = getImageApi(jellyfinClient.api).getItemBackdropImageUrls(item, {
    fillWidth: Math.round(width),
    quality: QUALITY,
  });
  return url;
}

export function logoImageUrl(item: BaseItemDto, width: number): string | undefined {
  return getImageApi(jellyfinClient.api).getItemImageUrl(item, ImageType.Logo, {
    fillWidth: Math.round(width),
  });
}

export function thumbImageUrl(item: BaseItemDto, width: number): string | undefined {
  return getImageApi(jellyfinClient.api).getItemImageUrl(item, ImageType.Thumb, {
    fillWidth: Math.round(width),
    quality: QUALITY,
  });
}

/** `BaseItemPerson` (cast/crew credits) carries its image tag directly rather than an
 * `ImageTags` map, so it needs the by-id builder instead of `getItemImageUrl`. */
export function personImageUrl(person: BaseItemPerson, width: number): string | undefined {
  if (!person.Id || !person.PrimaryImageTag) {
    return undefined;
  }
  return getImageApi(jellyfinClient.api).getItemImageUrlById(person.Id, ImageType.Primary, {
    fillWidth: Math.round(width),
    quality: QUALITY,
    tag: person.PrimaryImageTag,
  });
}
