export const slugify = (value) => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const buildUniqueSlug = async ({ baseText, findExistingBySlug }) => {
  const baseSlug = slugify(baseText);

  if (!baseSlug) {
    throw new Error("Unable to generate slug");
  }

  let slug = baseSlug;
  let counter = 1;

  while (await findExistingBySlug(slug)) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
};