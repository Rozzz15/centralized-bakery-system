import fs from 'fs';

const p = 'src/components/AdminDashboard.tsx';
let c = fs.readFileSync(p, 'utf8');

let changes = 0;

// 1. Add Links column header after Deco header
const oldHeader = `<th className="px-4 py-3">Deco</th><th className="px-4 py-3 w-32" />`;
const newHeader = `<th className="px-4 py-3">Deco</th><th className="px-4 py-3">Links</th><th className="px-4 py-3 w-32" />`;
if (c.includes(oldHeader)) {
  c = c.replace(oldHeader, newHeader);
  changes++;
  console.log('✓ Added Links column header');
} else {
  console.log('✗ Could not find Deco header');
}

// 2. Add Links cell after Deco cell
const decoEnd = `)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">`;

const linksInsert = `)}
                      </td>
                      <td className="px-4 py-3">
                        {recipe?.linkedProduct && recipe.linkedProduct.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {recipe.linkedProduct.map(lp => (
                              <span key={lp} className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">{lp}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">`;

if (c.includes(decoEnd)) {
  c = c.replace(decoEnd, linksInsert);
  changes++;
  console.log('✓ Added Links cell');
} else {
  console.log('✗ Could not find Deco cell ending');
}

fs.writeFileSync(p, c, 'utf8');
console.log(`\nDone. ${changes} changes made.`);
