/** Exact workspace package name, including scoped subpaths; no prefix guessing. */
export function workspacePackageName(specifier) {
  if (typeof specifier !== 'string' || specifier.startsWith('.') || specifier.startsWith('#')) return null;
  const parts=specifier.split('/');
  return specifier.startsWith('@') && parts.length>=2 ? parts.slice(0,2).join('/') : parts[0];
}
export function workspaceExportTarget(specifier,manifest) {
  const name=workspacePackageName(specifier);
  if(name!==manifest.name)return null;
  const key=specifier===name?'.':'.'+specifier.slice(name.length);
  const value=typeof manifest.exports==='string'&&key==='.'?manifest.exports:manifest.exports?.[key];
  // Conditional/wildcard exports are deliberately not guessed by a syntactic index.
  return typeof value==='string'&&value.startsWith('./')?value:null;
}
