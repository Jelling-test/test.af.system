export interface PowerReading {
  id: string;
  user_id: string;
  spot_number: string;
  timestamp: string;
  consumption_kwh: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  spot_number: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  amount: number;
  consumption_kwh: number;
  stripe_payment_id: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}
