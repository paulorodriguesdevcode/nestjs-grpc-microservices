import { Observable } from 'rxjs';

export interface RemoteUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface UsersServiceClient {
  createUser(data: { name: string; email: string }): Observable<RemoteUser>;
  getUser(data: { id: string }): Observable<RemoteUser>;
  listUsers(data: {}): Observable<{ users: RemoteUser[] }>;
}

export interface RemoteOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface RemoteOrder {
  id: string;
  userId: string;
  items: RemoteOrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

export interface OrdersServiceClient {
  createOrder(data: {
    userId: string;
    items: RemoteOrderItem[];
  }): Observable<RemoteOrder>;
  getOrder(data: { id: string }): Observable<RemoteOrder>;
  listOrders(data: { userId?: string }): Observable<{ orders: RemoteOrder[] }>;
}
