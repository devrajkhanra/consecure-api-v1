export interface IUserRepository {
  findById(id: string): Promise<any | null>;
  findAll(options?: { limit?: number; cursor?: string }): Promise<{
    data: any[];
    nextCursor: string | null;
  }>;
  saveUser(user: any): Promise<any>;
  createUser(userData: any): Promise<any>;
  updateUser(id: string, updateData: any): Promise<any>;
  removeUser(id: string): Promise<any>;
}