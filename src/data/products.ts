export type Product = {
  id: number;
  name: string;
  category: string;
  wholesalePrice: number;
  retailPrice: number;
  minimumOrder: number;
  stock: number;
  tone: string;
};

export const products: Product[] = [
  {
    id: 1,
    name: "Textured Ceramic Vase",
    category: "Home & Living",
    wholesalePrice: 12.5,
    retailPrice: 29.99,
    minimumOrder: 6,
    stock: 248,
    tone: "bg-[#e8e1d7]",
  },
  {
    id: 2,
    name: "Natural Cotton Throw",
    category: "Home & Living",
    wholesalePrice: 18,
    retailPrice: 42,
    minimumOrder: 4,
    stock: 122,
    tone: "bg-[#d8d2c4]",
  },
  {
    id: 3,
    name: "Minimal Glass Tumbler",
    category: "Kitchen",
    wholesalePrice: 6.75,
    retailPrice: 16,
    minimumOrder: 12,
    stock: 416,
    tone: "bg-[#dce5e1]",
  },
  {
    id: 4,
    name: "Woven Storage Basket",
    category: "Home Decor",
    wholesalePrice: 14.25,
    retailPrice: 32,
    minimumOrder: 6,
    stock: 74,
    tone: "bg-[#d8c7ad]",
  },
  {
    id: 5,
    name: "Essential Hand Cream",
    category: "Beauty",
    wholesalePrice: 4.8,
    retailPrice: 12,
    minimumOrder: 12,
    stock: 318,
    tone: "bg-[#e8ddd5]",
  },
  {
    id: 6,
    name: "Wooden Serving Board",
    category: "Kitchen",
    wholesalePrice: 11.4,
    retailPrice: 28,
    minimumOrder: 6,
    stock: 92,
    tone: "bg-[#d2bb9c]",
  },
  {
    id: 7,
    name: "Soft Linen Cushion",
    category: "Home Decor",
    wholesalePrice: 9.25,
    retailPrice: 24,
    minimumOrder: 8,
    stock: 186,
    tone: "bg-[#d9d3cb]",
  },
  {
    id: 8,
    name: "Everyday Canvas Tote",
    category: "Accessories",
    wholesalePrice: 7.5,
    retailPrice: 19.99,
    minimumOrder: 12,
    stock: 264,
    tone: "bg-[#dfd2bd]",
  },
];