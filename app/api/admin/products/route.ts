import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { readData, writeData, createBackup } from '@/lib/backup';

export async function GET() {
  const data = await readData();
  return NextResponse.json({ products: data.products, categories: data.categories });
}

export async function POST(req: Request) {
  const updates = await req.json();
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
  createBackup();
  data.products.push(newProduct);
  await writeData(data);
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, product: newProduct });
}
