declare global {
  namespace Express {
    interface Request {
      ownerId: string;
      requestId: string;
    }
  }
}
export {};
