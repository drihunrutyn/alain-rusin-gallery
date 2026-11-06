// The Render frontend serves assets at its root; Pages has its own base-path adapter.
export const assetUrl = (value: string) => value.startsWith("/images/uploads/") ? publicSiteUrl + value : value;
export const publicSiteUrl = "https://drihunrutyn.github.io/alain-rusin-gallery";
