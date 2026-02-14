/**
 * Tests for CardParser
 */

import { describe, it, expect } from 'vitest';
import { parseCard, parseCardStack } from './CardParser';

describe('CardParser', () => {
  describe('parseCard', () => {
    it('should parse basic card with name', () => {
      const data = {
        '@_identifier': 'card-001',
        data: [
          {
            '@_name': 'card',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Ace of Spades' }],
              },
            ],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.id).toBe('card-001');
      expect(result.type).toBe('card');
      expect(result.name).toBe('Ace of Spades');
    });

    it('should use fileName as fallback for name and id', () => {
      const data = {
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'fallback.xml');

      expect(result.id).toBe('fallback.xml');
      expect(result.name).toBe('fallback.xml');
    });

    it('should parse front and back images', () => {
      const data = {
        '@_identifier': 'card-002',
        data: [
          {
            '@_name': 'card',
            data: [
              {
                '@_name': 'image',
                data: [
                  { '@_name': 'front', '#text': 'front-img-001' },
                  { '@_name': 'back', '#text': 'back-img-001' },
                ],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test Card' }],
              },
            ],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.frontImage).not.toBeNull();
      expect(result.frontImage?.identifier).toBe('front-img-001');
      expect(result.frontImage?.name).toBe('front');

      expect(result.backImage).not.toBeNull();
      expect(result.backImage?.identifier).toBe('back-img-001');
      expect(result.backImage?.name).toBe('back');

      expect(result.images).toHaveLength(2);
    });

    it('should parse size from common data', () => {
      const data = {
        '@_identifier': 'card-size',
        data: [
          {
            '@_name': 'card',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'size', '#text': '2.5' }],
              },
            ],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.size).toBe(2.5);
    });

    it('should handle card with only front image', () => {
      const data = {
        '@_identifier': 'card-003',
        data: [
          {
            '@_name': 'card',
            data: [
              {
                '@_name': 'image',
                data: [{ '@_name': 'front', '#text': 'front-only' }],
              },
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Test' }],
              },
            ],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.frontImage).not.toBeNull();
      expect(result.backImage).toBeNull();
      expect(result.images).toHaveLength(1);
    });

    it('should parse isFaceUp attribute as true', () => {
      const data = {
        '@_identifier': 'card-004',
        '@_isFaceUp': 'true',
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.isFaceUp).toBe(true);
    });

    it('should parse isFaceUp attribute as false', () => {
      const data = {
        '@_identifier': 'card-005',
        '@_isFaceUp': 'false',
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.isFaceUp).toBe(false);
    });

    it('should default isFaceUp to true', () => {
      const data = {
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.isFaceUp).toBe(true);
    });

    it('should parse position', () => {
      const data = {
        '@_identifier': 'card-006',
        '@_location.x': '150',
        '@_location.y': '250',
        '@_posZ': '12',
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.position.x).toBe(150);
      expect(result.position.y).toBe(250);
      expect(result.position.z).toBe(12);
    });

    it('should parse position from location.x/location.y attributes', () => {
      const data = {
        '@_identifier': 'card-007',
        '@_location.x': '865.5179751952622',
        '@_location.y': '656.0392841109901',
        '@_posZ': '0',
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.position.x).toBeCloseTo(865.518, 2);
      expect(result.position.y).toBeCloseTo(656.039, 2);
      expect(result.position.z).toBe(0);
    });

    it('should default position to (0, 0)', () => {
      const data = {
        data: [
          {
            '@_name': 'card',
            data: [],
          },
        ],
      };

      const result = parseCard(data, 'test.xml');

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
      expect(result.position.z).toBe(0);
    });
  });

  describe('parseCardStack', () => {
    it('should parse basic card stack with name', () => {
      const data = {
        '@_identifier': 'stack-001',
        data: [
          {
            '@_name': 'card-stack',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Deck' }],
              },
            ],
          },
        ],
      };

      const result = parseCardStack(data, 'test.xml');

      expect(result.id).toBe('stack-001');
      expect(result.type).toBe('card-stack');
      expect(result.name).toBe('Deck');
    });

    it('should parse card stack with multiple cards', () => {
      const data = {
        '@_identifier': 'stack-002',
        data: [
          {
            '@_name': 'card-stack',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Deck' }],
              },
            ],
          },
        ],
        card: [
          {
            '@_identifier': 'card-in-stack-1',
            data: [
              {
                '@_name': 'card',
                data: [
                  {
                    '@_name': 'common',
                    data: [{ '@_name': 'name', '#text': 'Card 1' }],
                  },
                ],
              },
            ],
          },
          {
            '@_identifier': 'card-in-stack-2',
            data: [
              {
                '@_name': 'card',
                data: [
                  {
                    '@_name': 'common',
                    data: [{ '@_name': 'name', '#text': 'Card 2' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = parseCardStack(data, 'test.xml');

      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].name).toBe('Card 1');
      expect(result.cards[1].name).toBe('Card 2');
    });

    it('should parse card stack with single card (not array)', () => {
      const data = {
        '@_identifier': 'stack-003',
        data: [
          {
            '@_name': 'card-stack',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Single Card Stack' }],
              },
            ],
          },
        ],
        card: {
          '@_identifier': 'single-card',
          data: [
            {
              '@_name': 'card',
              data: [
                {
                  '@_name': 'common',
                  data: [{ '@_name': 'name', '#text': 'Only Card' }],
                },
              ],
            },
          ],
        },
      };

      const result = parseCardStack(data, 'test.xml');

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].name).toBe('Only Card');
    });

    it('should handle card stack with no cards', () => {
      const data = {
        '@_identifier': 'stack-004',
        data: [
          {
            '@_name': 'card-stack',
            data: [
              {
                '@_name': 'common',
                data: [{ '@_name': 'name', '#text': 'Empty Stack' }],
              },
            ],
          },
        ],
      };

      const result = parseCardStack(data, 'test.xml');

      expect(result.cards).toHaveLength(0);
    });

    it('should parse position', () => {
      const data = {
        '@_identifier': 'stack-005',
        '@_location.x': '300',
        '@_location.y': '400',
        '@_posZ': '8',
        data: [
          {
            '@_name': 'card-stack',
            data: [],
          },
        ],
      };

      const result = parseCardStack(data, 'test.xml');

      expect(result.position.x).toBe(300);
      expect(result.position.y).toBe(400);
      expect(result.position.z).toBe(8);
    });

    it('should parse position from location.x/location.y attributes', () => {
      const data = {
        '@_identifier': 'stack-006',
        '@_location.x': '750',
        '@_location.y': '625',
        '@_posZ': '0',
        data: [
          {
            '@_name': 'card-stack',
            data: [],
          },
        ],
      };

      const result = parseCardStack(data, 'test.xml');

      expect(result.position.x).toBe(750);
      expect(result.position.y).toBe(625);
      expect(result.position.z).toBe(0);
    });

    it('should use fileName as fallback for name and id', () => {
      const data = {
        data: [
          {
            '@_name': 'card-stack',
            data: [],
          },
        ],
      };

      const result = parseCardStack(data, 'fallback-stack.xml');

      expect(result.id).toBe('fallback-stack.xml');
      expect(result.name).toBe('fallback-stack.xml');
    });
  });
});
