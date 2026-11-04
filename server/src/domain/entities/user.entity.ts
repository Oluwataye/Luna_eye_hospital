export interface User {
  id: number;
  username: string;
  email?: string;
  password?: string;
  full_name: string;
  role: string;
  department?: string;
  phone_number?: string;
  status?: string;
  created_at?: string;
}
