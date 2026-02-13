/**
 * Parser for Udonarium Card and CardStack objects
 */

import { Card, CardStack, ImageRef } from '../../domain/UdonariumObject';
import { findDataByName, getTextValue, getBooleanValue, parsePosition } from './ParserUtils';

export function parseCard(data: unknown, fileName: string): Card {
  const root = data as Record<string, unknown>;
  const cardData = findDataByName(root.data, 'card');

  // Parse images
  const imageData = findDataByName(cardData, 'image');
  let frontImage: ImageRef | null = null;
  let backImage: ImageRef | null = null;

  const frontIdentifier = getTextValue(findDataByName(imageData, 'front'));
  if (frontIdentifier) {
    frontImage = { identifier: frontIdentifier, name: 'front' };
  }

  const backIdentifier = getTextValue(findDataByName(imageData, 'back'));
  if (backIdentifier) {
    backImage = { identifier: backIdentifier, name: 'back' };
  }

  // Parse common data
  const commonData = findDataByName(cardData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;

  // Parse state
  const isFaceUp = getBooleanValue(root['@_isFaceUp']) ?? true;

  // Parse position
  const position = parsePosition(root);

  const images: ImageRef[] = [];
  if (frontImage) images.push(frontImage);
  if (backImage) images.push(backImage);

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'card',
    name,
    position,
    images,
    properties: new Map(),
    isFaceUp,
    frontImage,
    backImage,
  };
}

export function parseCardStack(data: unknown, fileName: string): CardStack {
  const root = data as Record<string, unknown>;
  const stackData = findDataByName(root.data, 'card-stack');

  // Parse common data
  const commonData = findDataByName(stackData, 'common');
  const name = getTextValue(findDataByName(commonData, 'name')) || fileName;

  // Parse position
  const position = parsePosition(root);

  // Parse cards in stack.
  // Cards may be direct children or inside <node name="cardRoot">.
  const cards: Card[] = [];
  let cardElements = root.card;
  if (!cardElements) {
    const nodeElement = root.node as Record<string, unknown> | undefined;
    if (nodeElement) {
      cardElements = nodeElement.card;
    }
  }
  if (Array.isArray(cardElements)) {
    for (let i = 0; i < cardElements.length; i++) {
      const card = parseCard(cardElements[i] as unknown, `${fileName}_card_${i}`);
      cards.push(card);
    }
  } else if (cardElements) {
    const card = parseCard(cardElements, `${fileName}_card_0`);
    cards.push(card);
  }

  return {
    id: (root['@_identifier'] as string) || fileName,
    type: 'card-stack',
    name,
    position,
    images: [],
    properties: new Map(),
    cards,
  };
}
