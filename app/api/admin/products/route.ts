import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { readData, writeData, createBackup } from '@/lib/backup';
import { requireAdmin } from '@/lib/admin-guard';
import { pickProductFields } from '@/lib/product-fields';
import { computeStandaloneOriginal } from '@/lib/fake-discount';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const data = await readData();
  return NextResponse.json({ products: data.products, categories: data.categories });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const updates = pickProductFields(await req.json());
  const data = await readData();
  const maxId = Math.max(0, ...data.products.map((p: any) => p.id));
  const newId = maxId + 1;
  const newProduct = {
    id: newId,
    name: '',
    categoryId: data.categories[0]?.id ?? '',
    specification: '',
    description: '',
    price: 0,
    moq: 1,
    tags: [],
    isNew: false,
    isSale: false,
    isBestSeller: false,
    inStock: true,
    image: '',
    ...updates,
  };
  newProduct.id = newId; // ensure auto-incremented id wins

  // Auto-apply a fake "was/now" sale on creation (unless one was set explicitly),
  // so new products show a discount without a manual step. Admin can override or
  // clear the was-price in the editor afterwards. Same deterministic value the
  // bulk apply-fake-discounts script would assign to a standalone product.
  const np = newProduct as { price: number; originalPrice?: number; isSale?: boolean };
  if (np.originalPrice == null && typeof np.price === 'number') {
    const was = computeStandaloneOriginal(np.price, newId);
    if (was != null) {
      np.originalPrice = was;
      np.isSale = true;
    }
  }

  createBackup();
  data.products.push(newProduct);
  await writeData(data);
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, product: newProduct });
}
