import data from '../data/products.json';

interface Product { id: number; name: string; categoryId: string; groupId?: string }
const products = data.products as Product[];

for (const cat of data.categories) {
  const inCat = products.filter(p => p.categoryId === cat.id);
  if (inCat.length < 5) continue;
  const grouped = inCat.filter(p => p.groupId);
  const ungrouped = inCat.filter(p => !p.groupId);
  if (grouped.length < 5 || ungrouped.length === 0) continue;

  const groupIds = [...new Set(grouped.map(p => p.groupId!))];
  const dominantGroup = groupIds
    .map(g => ({ g, count: inCat.filter(p => p.groupId === g).length }))
    .sort((a, b) => b.count - a.count)[0];
  if (dominantGroup.count < 5) continue;

  const dominantIds = inCat.filter(p => p.groupId === dominantGroup.g).map(p => p.id);
  const minDom = Math.min(...dominantIds);
  const maxDom = Math.max(...dominantIds);
  const sandwiched = ungrouped.filter(p => p.id > minDom && p.id < maxDom);
  if (sandwiched.length > 0) {
    console.log(
      `${cat.id.padEnd(28)} dominant=${dominantGroup.g} (${dominantGroup.count}/${inCat.length})  sandwiched: ${sandwiched
        .map(p => `${p.id}:${p.name}`)
        .join(' | ')}`,
    );
  }
}
