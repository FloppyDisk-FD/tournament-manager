export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  avatar_url: string | null;
  created_at: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}
