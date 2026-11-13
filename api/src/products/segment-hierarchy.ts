// src/products/segment-hierarchy.ts
import { Segment } from '../../generated/prisma/enums';

// POULTRY and AQUACULTURE are kinds of livestock, so browsing LIVESTOCK has to
// include them - otherwise a chicken feed tagged POULTRY is invisible under the
// main navigation. Products stay tagged with the one accurate value.
export const SEGMENT_WITH_KINDS: Record<Segment, Segment[]> = {
    [Segment.HUMAN]: [Segment.HUMAN],
    [Segment.PET]: [Segment.PET],
    [Segment.POULTRY]: [Segment.POULTRY],
    [Segment.AQUACULTURE]: [Segment.AQUACULTURE],
    [Segment.LIVESTOCK]: [Segment.LIVESTOCK, Segment.POULTRY, Segment.AQUACULTURE],
};

export const expandSegments = (segments: Segment[]): Segment[] =>
    [...new Set(segments.flatMap((s) => SEGMENT_WITH_KINDS[s]))];
