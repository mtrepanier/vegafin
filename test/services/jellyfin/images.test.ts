import { jellyfinClient } from '../../../src/services/jellyfin/JellyfinClient';
import {
  primaryImageUrl,
  backdropImageUrl,
  logoImageUrl,
  thumbImageUrl,
  personImageUrl,
  seriesAwarePosterImageUrl,
  itemOrParentLogoImageUrl,
  userImageUrl,
} from '../../../src/services/jellyfin/images';

beforeAll(() => {
  jellyfinClient.update('https://jf.example.com', 'tok-123');
});

describe('primaryImageUrl', () => {
  it('builds a Primary image URL with the item tag, rounded width, and quality', () => {
    const url = primaryImageUrl({ Id: 'item-1', ImageTags: { Primary: 'tag-1' } }, 150.6);
    expect(url).toBe('https://jf.example.com/Items/item-1/Images/Primary?fillWidth=151&quality=90&tag=tag-1');
  });

  it('returns undefined when the item has no Id', () => {
    expect(primaryImageUrl({ ImageTags: { Primary: 'tag-1' } }, 150)).toBeUndefined();
  });

  it('omits the tag param when the item has no Primary image tag', () => {
    const url = primaryImageUrl({ Id: 'item-1' }, 150);
    expect(url).toBe('https://jf.example.com/Items/item-1/Images/Primary?fillWidth=150&quality=90');
  });
});

describe('backdropImageUrl', () => {
  it('returns the first of the item own backdrop tags', () => {
    const url = backdropImageUrl({ Id: 'item-1', BackdropImageTags: ['bd-1', 'bd-2'] }, 200);
    expect(url).toBe('https://jf.example.com/Items/item-1/Images/Backdrop?fillWidth=200&quality=90&tag=bd-1');
  });

  it('falls back to the parent backdrop when the item has none of its own', () => {
    const url = backdropImageUrl(
      { Id: 'item-1', ParentBackdropItemId: 'parent-1', ParentBackdropImageTags: ['parent-bd-1'] },
      200,
    );
    expect(url).toBe('https://jf.example.com/Items/parent-1/Images/Backdrop?fillWidth=200&quality=90&tag=parent-bd-1');
  });

  it('returns undefined when there are no own or parent backdrop tags', () => {
    expect(backdropImageUrl({ Id: 'item-1' }, 200)).toBeUndefined();
  });
});

describe('logoImageUrl', () => {
  it('builds a Logo image URL without a quality param', () => {
    const url = logoImageUrl({ Id: 'item-1', ImageTags: { Logo: 'logo-1' } }, 300);
    expect(url).toBe('https://jf.example.com/Items/item-1/Images/Logo?fillWidth=300&tag=logo-1');
  });
});

describe('thumbImageUrl', () => {
  it('builds a Thumb image URL with quality', () => {
    const url = thumbImageUrl({ Id: 'item-1', ImageTags: { Thumb: 'thumb-1' } }, 400);
    expect(url).toBe('https://jf.example.com/Items/item-1/Images/Thumb?fillWidth=400&quality=90&tag=thumb-1');
  });
});

describe('seriesAwarePosterImageUrl', () => {
  it('uses the series poster (by SeriesId/SeriesPrimaryImageTag) for an episode', () => {
    const url = seriesAwarePosterImageUrl(
      { Id: 'ep-1', SeriesId: 'series-1', SeriesPrimaryImageTag: 'series-tag-1', ImageTags: { Primary: 'ep-tag-1' } },
      150,
    );
    expect(url).toBe('https://jf.example.com/Items/series-1/Images/Primary?fillWidth=150&quality=90&tag=series-tag-1');
  });

  it('falls back to the item own Primary image when it has no series poster info', () => {
    const url = seriesAwarePosterImageUrl({ Id: 'movie-1', ImageTags: { Primary: 'movie-tag-1' } }, 150);
    expect(url).toBe('https://jf.example.com/Items/movie-1/Images/Primary?fillWidth=150&quality=90&tag=movie-tag-1');
  });
});

describe('itemOrParentLogoImageUrl', () => {
  it('uses the item own Logo tag when present', () => {
    const url = itemOrParentLogoImageUrl({ Id: 'item-1', ImageTags: { Logo: 'logo-1' } }, 300);
    expect(url).toBe('https://jf.example.com/Items/item-1/Images/Logo?fillWidth=300&tag=logo-1');
  });

  it('falls back to the parent logo (ParentLogoItemId/ParentLogoImageTag) when the item has none of its own', () => {
    const url = itemOrParentLogoImageUrl({ Id: 'ep-1', ParentLogoItemId: 'series-1', ParentLogoImageTag: 'series-logo-1' }, 300);
    expect(url).toBe('https://jf.example.com/Items/series-1/Images/Logo?fillWidth=300&tag=series-logo-1');
  });

  it('returns undefined when there is no own or parent logo', () => {
    expect(itemOrParentLogoImageUrl({ Id: 'item-1' }, 300)).toBeUndefined();
  });
});

describe('userImageUrl', () => {
  it('builds a Primary image URL when the user has an avatar tag', () => {
    const url = userImageUrl({ Id: 'user-1', PrimaryImageTag: 'avatar-1' }, 90);
    expect(url).toBe('https://jf.example.com/Users/user-1/Images/Primary?fillWidth=90&quality=90&tag=avatar-1');
  });

  it('returns undefined when the user has no PrimaryImageTag (unlike getUserImageUrl, which would still build a 404-prone URL)', () => {
    expect(userImageUrl({ Id: 'user-1' }, 90)).toBeUndefined();
  });
});

describe('personImageUrl', () => {
  it('builds a Primary image URL by person id/tag', () => {
    const url = personImageUrl({ Id: 'person-1', PrimaryImageTag: 'ptag-1' }, 100);
    expect(url).toBe('https://jf.example.com/Items/person-1/Images/Primary?fillWidth=100&quality=90&tag=ptag-1');
  });

  it('returns undefined when the person has no Id', () => {
    expect(personImageUrl({ PrimaryImageTag: 'ptag-1' }, 100)).toBeUndefined();
  });

  it('returns undefined when the person has no PrimaryImageTag', () => {
    expect(personImageUrl({ Id: 'person-1' }, 100)).toBeUndefined();
  });
});
