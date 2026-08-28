//#region node_modules/.nitro/vite/services/ssr/assets/browse-list-Cm4wC9Gf.js
var ids = [];
function rememberBrowseList(nextKind, nextIds) {
	ids = nextIds;
}
function neighborInBrowseList(id, dir) {
	if (!ids.length) return null;
	const index = ids.indexOf(id);
	if (index < 0) return dir > 0 ? ids[0] : ids[ids.length - 1];
	const next = index + (dir < 0 ? -1 : 1);
	if (next < 0) return ids[ids.length - 1];
	if (next >= ids.length) return ids[0];
	return ids[next];
}
//#endregion
export { rememberBrowseList as n, neighborInBrowseList as t };
