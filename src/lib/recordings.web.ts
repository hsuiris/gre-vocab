// Web has no bundled copy on purpose: the same recordings are served straight
// out of public/audio as URLs, so bundling them again would double the
// download for every visitor.
export const recordings: Record<string, number> = {};
