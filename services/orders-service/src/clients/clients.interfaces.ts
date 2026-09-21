import { Observable } from 'rxjs';

export interface RemoteUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface UsersServiceClient {
  getUser(data: { id: string }): Observable<RemoteUser>;
}

export interface NotificationResult {
  id: string;
  status: string;
}

export interface NotificationsServiceClient {
  sendNotification(data: {
    userId: string;
    channel: string;
    message: string;
  }): Observable<NotificationResult>;
}
