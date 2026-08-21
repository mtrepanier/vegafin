import { jellyfinClient } from '../../../src/services/jellyfin/JellyfinClient';
import { primaryImageUrl, backdropImageUrl, logoImageUrl, thumbImageUrl, personImageUrl } from '../../../src/services/jellyfin/images';

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
