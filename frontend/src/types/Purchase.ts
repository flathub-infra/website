export interface Purchase {
  token?: string;
  appids: string[];
}

export interface TransactionStateAction {
  token: string;
}