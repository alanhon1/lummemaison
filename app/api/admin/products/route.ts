import { NextResponse } from 'next/server';
import { products, categories } from '@/lib/products';

export async function GET() {
  return NextResponse.json({ products, categories });
}
