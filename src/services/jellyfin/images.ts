import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models/base-item-person';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
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
 * Portrait poster art for Continue Watching/Next Up cards. An episode's own Primary/Thumb tags
 * (when it even has them) are a landscape screenshot-style still - stretched into the same
 * portrait card every other row uses, it read as the wrong item entirely. Jellyfin carries the
 * parent series' own poster right on the episode DTO (`SeriesId`/`SeriesPrimaryImageTag`), so an
 * episode uses that instead; movies and everything else just fall through to their own Primary.
 */
export function seriesAwarePosterImageUrl(item: BaseItemDto, width: number): string | undefined {
  if (item.SeriesId && item.SeriesPrimaryImageTag) {
    return getImageApi(jellyfinClient.api).getItemImageUrlById(item.SeriesId, ImageType.Primary, {
      fillWidth: Math.round(width),
      quality: QUALITY,
      tag: item.SeriesPrimaryImageTag,
    });
  }
  return primaryImageUrl(item, width);
}

/**
 * Franchise/show logo for the Home hero (`HomeHero.tsx`). Same parent-fallback shape as
 * `seriesAwarePosterImageUrl`, but Logo has no server-side parent-aware helper the way
 * `getItemBackdropImageUrls` has for backdrops, and unlike Primary/Thumb, an episode's own
 * `ImageTags.Logo` essentially never exists - so this checks tag presence itself at each level
 * (own, then `ParentLogoItemId`/`ParentLogoImageTag`) rather than delegating to the SDK.
 */
export function itemOrParentLogoImageUrl(item: BaseItemDto, width: number): string | undefined {
  if (item.ImageTags?.Logo) {
    return logoImageUrl(item, width);
  }
  if (item.ParentLogoItemId && item.ParentLogoImageTag) {
    return getImageApi(jellyfinClient.api).getItemImageUrlById(item.ParentLogoItemId, ImageType.Logo, {
      fillWidth: Math.round(width),
      tag: item.ParentLogoImageTag,
    });
  }
  return undefined;
}

/** The signed-in user's own avatar - like `getItemImageUrl`, the SDK's `getUserImageUrl`
 * always builds a URL as long as the user has an Id, regardless of whether a PrimaryImageTag
 * actually exists, so that check has to happen here rather than relying on the URL being
 * undefined when there's no avatar set. */
export function userImageUrl(user: UserDto, width: number): string | undefined {
  if (!user.PrimaryImageTag) {
    return undefined;
  }
  return getImageApi(jellyfinClient.api).getUserImageUrl(user, {
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
