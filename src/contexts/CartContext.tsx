import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

// Extract multiplier from description like "250/10" -> 10
export const getDescriptionMultiplier = (description: string): number => {
  if (!description) return 1;
  const match = description.match(/^\d+\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
};

// Calculate item total with description multiplier
export const calculateItemTotal = (item: CartItem): number => {
  const multiplier = getDescriptionMultiplier(item.description);
  return item.price * item.quantity * multiplier;
};

interface CartContextType {
  items: CartItem[];
  addItem: (product: Omit<CartItem, 'id' | 'quantity'>, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Omit<CartItem, 'id' | 'quantity'>, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.productId === product.productId);
      if (existing) {
        return prev.map(item =>
          item.productId === product.productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, id: crypto.randomUUID(), quantity }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity } : item))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
