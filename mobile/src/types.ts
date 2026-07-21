export type OrderStatus = "Nuovo" | "Confermato" | "Rifiutato";

export type OrderProduct = {
  id: string;
  name: string;
  price: string;
  size: string;
  quantity: number;
  value: number;
};

export type MobileOrder = {
  id: string;
  orderCode: string;
  createdAt: string;
  status: OrderStatus;
  statusUpdatedAt: string;
  statusHistory: Array<{ status: OrderStatus; at: string }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  paymentMethod: string;
  txHash: string;
  discountCode: string;
  products: OrderProduct[];
  totalValue: number;
  total: string;
};

export type OrdersDashboard = {
  generatedAt: string;
  confirmedRevenue: number;
  pendingRevenue: number;
  todayRevenue: number;
  averageConfirmedOrder: number;
  counts: {
    all: number;
    new: number;
    confirmed: number;
    rejected: number;
  };
  monthlyRevenue: Array<{ month: string; revenue: number }>;
};

export type MobileSession = {
  token: string;
  expiresAt: string;
};

export type ShippingLabel = {
  orderId: string;
  orderCode: string;
  generatedAt: string;
  html: string;
};

export type OrdersFilter = "all" | "new" | "confirmed" | "rejected";
