export type Slot = 'drink' | 'size' | 'temp' | 'milk' | 'extras' | 'quantity' | 'pickup' | 'name';

export type Order = Partial<{

    drink: string; size: string; temp: 'hot'| "iced"; milk: string;
    extras: string[]; quantity: number; pickup: string; name: string;   
}>;

export type UserEvent =
  | { kind: 'text'; text: string }   
  | { kind: 'edit'; slot: Slot }     
  | { kind: 'back' }
  | { kind: 'restart' }
  | { kind: 'start' };               // ask for the opening greeting (no user input yet)

export type EngineOutput = {
  reply: string;                     
  order: Order;                      
  quickReplies: string[];            
  phase: 'collecting' | 'confirming' | 'done';
  asking?: Slot;                     // slot the reply is asking for (lets the UI highlight it / focus the keyboard)
};

export interface Engine {
  start(): EngineOutput;                  // Hunter's greeting + first quick replies
  handle(event: UserEvent): EngineOutput; // every user action after that
}
