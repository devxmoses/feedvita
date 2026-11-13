import { Segment } from '../../generated/prisma/enums';
import { SEGMENT_WITH_KINDS, expandSegments } from './segment-hierarchy';

describe('expandSegments', () => {
  it('widens LIVESTOCK to include every kind of livestock', () => {
    expect(expandSegments([Segment.LIVESTOCK]).sort()).toEqual(
      [Segment.AQUACULTURE, Segment.LIVESTOCK, Segment.POULTRY].sort(),
    );
  });

  // asking for poultry must not drag in cattle - the hierarchy only widens downward
  it('leaves a narrow kind narrow', () => {
    expect(expandSegments([Segment.POULTRY])).toEqual([Segment.POULTRY]);
    expect(expandSegments([Segment.AQUACULTURE])).toEqual([Segment.AQUACULTURE]);
  });

  it('leaves the two non-hierarchical segments alone', () => {
    expect(expandSegments([Segment.HUMAN])).toEqual([Segment.HUMAN]);
    expect(expandSegments([Segment.PET])).toEqual([Segment.PET]);
  });

  it('merges overlapping requests without duplicating a value', () => {
    const result = expandSegments([Segment.LIVESTOCK, Segment.POULTRY]);

    expect(result).toHaveLength(new Set(result).size);
    expect(result.sort()).toEqual(
      [Segment.AQUACULTURE, Segment.LIVESTOCK, Segment.POULTRY].sort(),
    );
  });

  it('combines unrelated segments', () => {
    expect(expandSegments([Segment.HUMAN, Segment.PET]).sort()).toEqual(
      [Segment.HUMAN, Segment.PET].sort(),
    );
  });

  it('returns nothing for an empty request', () => {
    expect(expandSegments([])).toEqual([]);
  });

  // a value added to the enum but forgotten here would expand to [undefined],
  // which Prisma rejects at runtime rather than at compile time
  it('maps every value in the enum', () => {
    for (const segment of Object.values(Segment)) {
      expect(SEGMENT_WITH_KINDS[segment]).toBeDefined();
      expect(SEGMENT_WITH_KINDS[segment]).toContain(segment);
    }
  });

  it('never expands to a value outside the enum', () => {
    const valid = new Set(Object.values(Segment));

    for (const segment of Object.values(Segment)) {
      for (const expanded of expandSegments([segment])) {
        expect(valid.has(expanded)).toBe(true);
      }
    }
  });
});
