import productsData from '@/data/products.json';

export interface Category {
  id: string;
  name: string;
  range: [number, number];
}

export interface EnrichedInfo {
  benefits?: string[];
  treatmentAreas?: string[];
  protocol?: string;
  ingredients?: string;
  duration?: string;
}

export interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  price: number;
  tags: string[];
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  inStock: boolean;
  image: string;
  moq: number;
  enrichedInfo?: EnrichedInfo;
}

export const categories: Category[] = productsData.categories as Category[];
export const products: Product[] = productsData.products as Product[];

export function getProductById(id: number): Product | undefined {
  return products.find(p => p.id === id);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return products.filter(p => p.categoryId === categoryId);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id);
}

export function getBestSellers(limit = 8): Product[] {
  return products.filter(p => p.isBestSeller).slice(0, limit);
}

export function getNewProducts(limit = 8): Product[] {
  return products.filter(p => p.isNew).slice(0, limit);
}

export function getSaleProducts(limit = 8): Product[] {
  return products.filter(p => p.isSale).slice(0, limit);
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.specification.toLowerCase().includes(q) ||
    p.categoryId.includes(q)
  );
}
