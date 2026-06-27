export interface Product {
  id: number;
  name: string;
  category: string;
  useCase: string;
  price: number;
  brand: string;
  specs: string;
  imageEmoji: string;
  popularity: number;
  inStock: boolean;
  stockCount: number;
}

export interface CartItem {
  product: Product;
  qty: number;
}
