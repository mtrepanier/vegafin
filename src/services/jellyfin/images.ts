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

/**
 * Landscape-oriented image for Continue Watching/Next Up cards: Thumb when the item actually
 * has one, otherwise Primary. `thumbImageUrl`/`primaryImageUrl` always build a URL as long as
 * the item has an Id - the SDK's `getItemImageUrl` doesn't check whether that image type's tag
 * actually exists before constructing the request (unlike its own backdrop helper, which does)
 * - so a naive `thumbImageUrl(item, w) ?? primaryImageUrl(item, w)` never falls back and just
 * 404s for episodes, which almost never have their own Thumb image, only Primary. Checking
 * `ImageTags.Thumb` directly here is what makes the fallback real.
 */
export function continueWatchingImageUrl(item: BaseItemDto, width: number): string | undefined {
  return item.ImageTags?.Thumb ? thumbImageUrl(item, width) : primaryImageUrl(item, width);
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
