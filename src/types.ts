export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: Date;
  category: string;
  userId: string;
  createdAt: Date;
  recurrenceId?: string;
  recurrenceIndex?: number;
  recurrenceTotal?: number; // Total count, 0 or null for eternal
  isSubscription?: boolean;
  cancelReminderDate?: Date;
  reminderSent?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
