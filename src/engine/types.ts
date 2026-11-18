export type Slot = 'drink' | 'size' | 'temp' | 'milk' | 'extras' | 'quantity' | 'pickup' | 'name';

export type Order = Partial<{

    drink: string; size: string; temp: 'hot'| "iced"; milk: string;
    extras: string[]; quantity: number; pickup: string; name: string;   
}>;

export type UserEvent =
  | { kind: 'text'; text: string }   
  | { kind: 'edit'; slot: Slot }     
  | { kind: 'back' }
  | { kind: 'restart' };

export type EngineOutput = {
  reply: string;                     
  order: Order;                      
  quickReplies: string[];            
  phase: 'collecting' | 'confirming' | 'done';
};

