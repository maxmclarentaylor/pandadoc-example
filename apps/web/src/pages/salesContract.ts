import { MessageSquarePlus, Palette, Shapes, type LucideIcon } from 'lucide-react'
import type { Chunk } from '../chunks/types'

export const BLOCK_ACTIONS: { label: string; icon: LucideIcon }[] = [
  { label: 'Add to content library', icon: Shapes },
  { label: 'Add a comment', icon: MessageSquarePlus },
  { label: 'Text block design', icon: Palette },
]

export const STARTING_CHUNKS: Chunk[] = [
  { id: 'title', type: 'text', text: 'Sales Contract' },
  {
    id: 'intro',
    type: 'text',
    text: 'This Sales Contract ("Contract") is between the Seller and the Buyer named below. It covers the goods listed in this document, and the price, delivery, and other terms that follow. It is effective on the date shown here.',
  },
  { id: 'effective-label', type: 'text', text: 'Effective date' },
  { id: 'effective-date', type: 'date', value: '2026-01-15' },
  {
    id: 'parties',
    type: 'text',
    text: '1. Parties\n\nThe Seller agrees to sell the goods, and the Buyer agrees to buy them, on the terms in this Contract. Each party confirms that it has authority to enter into this Contract.',
  },
  {
    id: 'goods',
    type: 'text',
    text: '2. Goods\n\nThe Seller will supply the goods described below, in the quantities listed. The goods will match that description in all material respects. Any change to the goods, quantities, or prices must be agreed in writing.',
  },
  {
    id: 'pricing',
    type: 'table',
    columns: ['Item', 'Quantity', 'Unit price'],
    rows: [
      ['Standard widget', '10', '25.00'],
      ['Deluxe widget', '2', '80.00'],
      ['Delivery', '1', '40.00'],
    ],
  },
  {
    id: 'payment',
    type: 'text',
    text: '3. Price and payment\n\nThe total price is the sum of the lines above. The Buyer will pay that amount within 30 days of the invoice date. Prices are in the currency stated on the invoice and do not include taxes, which the Buyer will pay where required.',
  },
  {
    id: 'delivery',
    type: 'text',
    text: '4. Delivery\n\nThe Seller will deliver the goods to the address the Buyer provides. Risk in the goods passes to the Buyer on delivery. The Buyer will inspect the goods promptly and tell the Seller about any shortage or visible damage within 5 business days.',
  },
  {
    id: 'warranty',
    type: 'text',
    text: '5. Warranty\n\nThe Seller warrants that it has the right to sell the goods and that they are free of undisclosed liens. Except for this warranty, the goods are provided as described in this Contract.',
  },
  {
    id: 'general',
    type: 'text',
    text: '6. General\n\nThis Contract is the entire agreement between the parties about these goods. It may be changed only in writing signed by both parties. If one part of this Contract cannot be enforced, the rest remains in effect. This demo contract is a sample only and is not legal advice.',
  },
  { id: 'seller-label', type: 'text', text: 'Seller' },
  { id: 'seller-signature', type: 'signature', dataUrl: '' },
  { id: 'seller-date', type: 'date', value: '' },
  { id: 'buyer-label', type: 'text', text: 'Buyer' },
  { id: 'buyer-signature', type: 'signature', dataUrl: '' },
  { id: 'buyer-date', type: 'date', value: '' },
]
